import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import IVectorFinanceStakingArtifact
    from '../../../artifacts/contracts/interfaces/IVectorFinanceStaking.sol/IVectorFinanceStaking.json';
import IVectorRewarderArtifact from '../../../artifacts/contracts/interfaces/IVectorRewarder.sol/IVectorRewarder.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    fromBytes32,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    time,
    toBytes32,
    toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    MockTokenManager,
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;


const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const VectorUSDCStaking1 = '0xE5011Ab29612531727406d35cd9BcCE34fAEdC30';
const VectorWAVAXStaking1 = '0xab42ed09F43DDa849aa7F62500885A973A38a8Bc';
const VectorSAVAXStaking1 = '0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with Vector staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            owner: SignerWithAddress,
            nonOwner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            diamondAddress: any;

        before("deploy factory and pool", async () => {
            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'sAVAX', 'USDC', 'PTP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor)

            tokensPrices = await getTokensPricesMap(assetsList.filter(el => el !== 'PTP'), getRedstonePrices, [{symbol: 'PTP', value: 0.072}]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList.filter(asset => !Array.from(tokenContracts.keys()).includes(asset)));

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await tokenManager.setDebtCoverage(VectorUSDCStaking1, toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverage(VectorWAVAXStaking1, toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverage(VectorSAVAXStaking1, toWei("0.8333333333333333"));

            await tokenManager.setDebtCoverageStaked(toBytes32("VF_USDC_MAIN"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("VF_AVAX_SAVAX"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("VF_SAVAX_MAIN"), toWei("0.8333333333333333"));

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            let exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary");

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            await deployAllFacets(diamondAddress)
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();
            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(nonOwner))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should fund a loan, get USDC and sAVAX and borrow", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));

            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("sAVAX"), toWei("80"), 0);
            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDC"), toWei("80"), 0);

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(500 * tokensPrices.get('AVAX')!, 80);
        });

        it("should fail to stake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.vectorStakeUSDC1(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorStakeWAVAX1(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorStakeSAVAX1(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.vectorUnstakeUSDC1(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorUnstakeWAVAX1(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorUnstakeSAVAX1(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake", async () => {
           await testStake("vectorStakeUSDC1", "vectorUSDC1Balance", VectorUSDCStaking1, parseUnits('400', BigNumber.from("6")));
           await testStake("vectorStakeWAVAX1", "vectorWAVAX1Balance", VectorWAVAXStaking1, toWei('60'));
           await testStake("vectorStakeSAVAX1", "vectorSAVAX1Balance", VectorSAVAXStaking1, toWei('60'));

            await time.increase(time.duration.days(30));
        });

        it("should unstake", async () => {
            await testUnstake("vectorUnstakeUSDC1", "vectorUSDC1Balance", VectorUSDCStaking1, parseUnits('50', BigNumber.from("6")));
            await testUnstake("vectorUnstakeWAVAX1", "vectorWAVAX1Balance", VectorWAVAXStaking1, toWei('30'));
            await testUnstake("vectorUnstakeSAVAX1", "vectorSAVAX1Balance", VectorSAVAXStaking1, toWei('30'));
        });

        async function testStake(stakeMethod: string, balanceMethod: string, stakingContractAddress: string, amount: BigNumber) {

            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let stakingContract = await new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider);

            let initialStakedBalance = await stakingContract.balance(wrappedLoan.address);

            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan[stakeMethod](toWei("9999"), {gasLimit: 8000000})).to.be.revertedWith("Not enough token available");

            await wrappedLoan[stakeMethod](amount);

            expect(await wrappedLoan[balanceMethod]()).to.be.equal(amount);
            expect(await stakingContract.balance(wrappedLoan.address)).to.be.equal(amount);

            expect(await wrappedLoan.getTotalValue()).to.be.closeTo(initialTotalValue, 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.00001);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 0.00001);
        }

        async function testUnstake(unstakeMethod: string, balanceMethod: string, stakingContractAddress: string, amount: BigNumber) {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();

            let stakingContract = await new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider);

            let initialStakedBalance = await stakingContract.balance(wrappedLoan.address);

            let rewardTokens = await getRewardTokens(stakingContract);
            // convert from address to symbol
            rewardTokens = rewardTokens.map((token) => getSymbol(token));

            //accepted max. 10% withdrawal fee
            await wrappedLoan[unstakeMethod](amount, amount.div(BigNumber.from(10)).mul(BigNumber.from(9)));

            expect(await wrappedLoan[balanceMethod]()).to.be.equal(initialStakedBalance.sub(amount));
            expect(await stakingContract.balance(wrappedLoan.address)).to.be.equal(initialStakedBalance.sub(amount));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.001);

            for(const rewardToken of rewardTokens){
                let ownedAssets = await wrappedLoan.getAllOwnedAssets();
                if(isRewardTokenSupported(rewardToken)){
                    if((await tokenContracts.get(rewardToken)!.balanceOf(wrappedLoan.address)) > 0){
                        expect((ownedAssets).includes(toBytes32(rewardToken))).to.be.true;
                        continue;
                    }
                }
                expect((ownedAssets).includes(toBytes32(rewardToken))).to.be.false;
            }

        }

        async function getRewardTokens(stakingContract: Contract) {
            let rewarder = await new ethers.Contract(await stakingContract.rewarder(), IVectorRewarderArtifact.abi, provider);
            let rewardTokens = [];

            let index = 0;
            while(true){
                try {
                    rewardTokens.push(await rewarder.rewardTokens(index));
                } catch (error) {
                    break;
                }
                index++;
            }
            return rewardTokens;
        }

        function isRewardTokenSupported(rewardToken: string) {
            let supported = false;
            for(const asset of supportedAssets) {
                if(fromBytes32(asset.asset) === rewardToken) {
                    supported = true;
                    break;
                }
            }
            return supported;
        }

        it("should fail to unstake more than was initially staked", async () => {
            await expect(wrappedLoan.vectorUnstakeUSDC1(toWei("9999"), toWei("9999"))).to.be.revertedWith("Cannot unstake more than was initially staked");
            await expect(wrappedLoan.vectorUnstakeWAVAX1(toWei("9999"), toWei("9999"))).to.be.revertedWith("Cannot unstake more than was initially staked");
            await expect(wrappedLoan.vectorUnstakeSAVAX1(toWei("9999"), toWei("9999"))).to.be.revertedWith("Cannot unstake more than was initially staked");
        });

        it("should allow anyone to unstake if insolvent", async () => {
            await expect(nonOwnerWrappedLoan.vectorUnstakeUSDC1(parseUnits('2', BigNumber.from("6")), parseUnits('1', BigNumber.from("6")))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");;

            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1100"));

            await diamondCut.pause();
            await replaceFacet('SolvencyFacetMock', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            expect(await wrappedLoan.isSolvent()).to.be.false;

            await expect(nonOwnerWrappedLoan.vectorUnstakeUSDC1(parseUnits('2', BigNumber.from("6")), parseUnits('1', BigNumber.from("6")))).not.to.be.reverted;
        });

        function getSymbol(address: string) {
            return getKeyByValue(TOKEN_ADDRESSES, address);
        }

        function getKeyByValue(object: any, value: any) {
            return Object.keys(object).find(key => object[key].toLowerCase() === value.toLowerCase());
        }
    });
});

