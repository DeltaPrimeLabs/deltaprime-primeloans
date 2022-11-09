import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
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
    PangolinIntermediary,
    RedstoneConfigManager__factory,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TokenManager,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;


const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const VectorUSDCStaking1 = '0x7550B2d6a1F039Dd6a3d54a857FEFCbF77213D80';
const VectorUSDCStaking2 = '0xDA9E515Ce714c4309f7C4483F4802556AE5Df396';
const VectorWAVAXStaking1 = '0xff5386aF93cF4bD8d5AeCad6df7F4f4be381fD69';
const VectorSAVAXStaking1 = '0x812b7C3b5a9164270Dd8a0b3bc47550877AECdB1';

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
            let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));

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
                TokenManagerArtifact,
                [
                    supportedAssets,
                    lendingPools,
                ]
            ) as TokenManager;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                redstoneConfigManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            let exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, supportedAssets, "PangolinIntermediary");

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
                redstoneConfigManager.address,
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

        it("should fund a loan and get USDC and sAVAX", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));

            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("sAVAX"), toWei("10"), 0);
            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDC"), toWei("20"), 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(200 * tokensPrices.get('AVAX')!, 10);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal( 1.157920892373162e+59);
        });

        it("should fail to stake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.vectorStakeUSDC1(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorStakeUSDC2(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorStakeWAVAX1(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorStakeSAVAX1(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.vectorUnstakeUSDC1(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorUnstakeUSDC2(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorUnstakeWAVAX1(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.vectorUnstakeSAVAX1(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake", async () => {
           await testStake("vectorStakeUSDC1", "vectorUSDC1Balance", VectorUSDCStaking1, parseUnits('13', BigNumber.from("6")));
           await testStake("vectorStakeUSDC2", "vectorUSDC2Balance", VectorUSDCStaking2, parseUnits('11', BigNumber.from("6")));
           await testStake("vectorStakeWAVAX1", "vectorWAVAX1Balance", VectorWAVAXStaking1, toWei('5'));
           await testStake("vectorStakeSAVAX1", "vectorSAVAX1Balance", VectorSAVAXStaking1, toWei('6'));
           await time.increase(time.duration.days(30));
        });

        it("should unstake", async () => {
            await testUnstake("vectorUnstakeUSDC1", "vectorUSDC1Balance", VectorUSDCStaking1, parseUnits('2', BigNumber.from("6")));
            await testUnstake("vectorUnstakeUSDC2", "vectorUSDC2Balance", VectorUSDCStaking2, parseUnits('2', BigNumber.from("6")));
            await testUnstake("vectorUnstakeWAVAX1", "vectorWAVAX1Balance", VectorWAVAXStaking1, toWei('1'));
            await testUnstake("vectorUnstakeSAVAX1", "vectorSAVAX1Balance", VectorSAVAXStaking1, toWei('1'));
        });

        async function testStake(stakeMethod: string, balanceMethod: string, stakingContractAddress: string, amount: BigNumber) {

            let initialTotalValue = await wrappedLoan.getTotalValue();

            let stakingContract = await new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider);

            let initialStakedBalance = await stakingContract.balance(wrappedLoan.address);

            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan[stakeMethod](toWei("9999"), {gasLimit: 8000000})).to.be.revertedWith("Not enough token available");

            await wrappedLoan[stakeMethod](amount);

            expect(await wrappedLoan[balanceMethod]()).to.be.equal(amount);
            expect(await stakingContract.balance(wrappedLoan.address)).to.be.equal(amount);

            expect(await wrappedLoan.getTotalValue()).to.be.closeTo(initialTotalValue, 5);
        }

        async function testUnstake(unstakeMethod: string, balanceMethod: string, stakingContractAddress: string, amount: BigNumber) {
            let initialTotalValue = await wrappedLoan.getTotalValue();

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
            await expect(wrappedLoan.vectorUnstakeUSDC2(toWei("9999"), toWei("9999"))).to.be.revertedWith("Cannot unstake more than was initially staked");
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

