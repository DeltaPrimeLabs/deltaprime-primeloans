import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import IVectorFinanceStakingArtifact
    from '../../../artifacts/contracts/interfaces/IVectorFinanceStaking.sol/IVectorFinanceStaking.json';
import IVectorRewarderArtifact from '../../../artifacts/contracts/interfaces/IVectorRewarder.sol/IVectorRewarder.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    deployRecoveryManager,
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
    toWei,
    GLPManagerRewarderAbi,
    erc20ABI,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    AddressProvider,
    MockTokenManager,
    PangolinIntermediary,
    RecoveryManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import { IVectorFinanceCompounder__factory } from './../../../typechain/factories/IVectorFinanceCompounder__factory';
import {BigNumber, Contract, constants} from "ethers";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;


const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const VectorUSDCStaking1 = '0x7d44f9eb1ffa6848362a966ef7d6340d14f4af7e';
const VectorUSDTStaking1 = '0xc57d07fedD6ad36F7334B84C4F1DFd2768999E9D';
const VectorWAVAXStaking1 = '0xab42ed09F43DDa849aa7F62500885A973A38a8Bc';
const VectorSAVAXStaking1 = '0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7';
const GLP_REWARDER_ADDRESS = "0xB70B91CE0771d3f4c81D87660f71Da31d48eB3B3";
const STAKED_GLP_ADDRESS = "0xaE64d55a6f09E4263421737397D1fdFA71896a69";
const GLP_MANAGER_ADDRESS = "0xD152c7F25db7F4B95b7658323c5F33d176818EE4";

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with Vector staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            glpManagerContract: Contract,
            stakedGlpContract: Contract,
            glpBalanceAfterMint: any,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            recoveryManager: RecoveryManager,
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
            let assetsList = ['AVAX', 'sAVAX', 'USDC', 'USDT', 'PTP', 'YY_AAVE_AVAX', 'YY_PTP_sAVAX', 'GLP', 'YY_GLP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            glpManagerContract = new ethers.Contract(GLP_REWARDER_ADDRESS, GLPManagerRewarderAbi, provider);
            stakedGlpContract = new ethers.Contract(STAKED_GLP_ADDRESS, erc20ABI, provider);

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 2000);

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
            await tokenManager.setDebtCoverage(VectorUSDTStaking1, toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverage(VectorWAVAXStaking1, toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverage(VectorSAVAXStaking1, toWei("0.8333333333333333"));

            await tokenManager.setDebtCoverageStaked(toBytes32("VF_USDC_MAIN_AUTO"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("VF_USDT_MAIN_AUTO"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("VF_AVAX_SAVAX_AUTO"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("VF_SAVAX_MAIN_AUTO"), toWei("0.8333333333333333"));

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            recoveryManager = await deployRecoveryManager(owner);
            await addressProvider.connect(owner).initialize();
            await addressProvider.connect(owner).setRecoveryContract(recoveryManager.address);

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                addressProvider.address,
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
                addressProvider.address,
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

        it("should mint GLP for owner", async () => {
            let currentGlpBalance = await tokenContracts.get("GLP")!.balanceOf(owner.address);
            let currentStakedGlpBalance = await stakedGlpContract.balanceOf(owner.address);
            expect(currentGlpBalance).to.be.equal(0);

            const minGlpAmount = tokensPrices.get("AVAX")! / tokensPrices.get("GLP")! * 98 / 100;

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("10")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(GLP_MANAGER_ADDRESS, toWei("10"));
            await glpManagerContract.connect(owner).mintAndStakeGlp(
                TOKEN_ADDRESSES['AVAX'],
                toWei("10"),
                0,
                toWei(minGlpAmount.toString())
            );

            glpBalanceAfterMint = await tokenContracts.get("GLP")!.balanceOf(owner.address);
            currentStakedGlpBalance = await stakedGlpContract.balanceOf(owner.address)
            expect(glpBalanceAfterMint).to.be.gt(0);
        });

        it("should fund a loan, get USDC and sAVAX and borrow", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));

            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("sAVAX"), toWei("50"), 0);
            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDC"), toWei("50"), 0);
            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDT"), toWei("50"), 0);

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));

            await stakedGlpContract.connect(owner).approve(wrappedLoan.address, glpBalanceAfterMint);
            await wrappedLoan.connect(owner).fundGLP(glpBalanceAfterMint);
        });

        it("should stake on VF", async () => {
            await testStake("vectorStakeUSDC1Auto", "vectorUSDC1BalanceAuto", VectorUSDCStaking1, parseUnits('100', BigNumber.from("6")));
            await testStake("vectorStakeUSDT1Auto", "vectorUSDT1BalanceAuto", VectorUSDTStaking1, parseUnits('100', BigNumber.from("6")));
            await testStake("vectorStakeWAVAX1Auto", "vectorWAVAX1BalanceAuto", VectorWAVAXStaking1, toWei('10'));
            await testStake("vectorStakeSAVAX1Auto", "vectorSAVAX1BalanceAuto", VectorSAVAXStaking1, toWei('10'));

            await time.increase(time.duration.days(30));
        });

        it("should recover assets from VF", async () => {
            await recoveryManager.recoverAssets([
                {
                    asset: toBytes32("VF_USDC_MAIN_AUTO"),
                    underlying: (await tokenContracts.get('USDC')!).address,
                    accounts: [wrappedLoan.address],
                    token0: constants.AddressZero,
                    token1: constants.AddressZero,
                    minAmount0: 0,
                    minAmount1: 0,
                },
                {
                    asset: toBytes32("VF_USDT_MAIN_AUTO"),
                    underlying: (await tokenContracts.get('USDT')!).address,
                    accounts: [wrappedLoan.address],
                    token0: constants.AddressZero,
                    token1: constants.AddressZero,
                    minAmount0: 0,
                    minAmount1: 0,
                },
                {
                    asset: toBytes32("VF_AVAX_SAVAX_AUTO"),
                    underlying: (await tokenContracts.get('AVAX')!).address,
                    accounts: [wrappedLoan.address],
                    token0: constants.AddressZero,
                    token1: constants.AddressZero,
                    minAmount0: 0,
                    minAmount1: 0,
                },
                {
                    asset: toBytes32("VF_SAVAX_MAIN_AUTO"),
                    underlying: (await tokenContracts.get('sAVAX')!).address,
                    accounts: [wrappedLoan.address],
                    token0: constants.AddressZero,
                    token1: constants.AddressZero,
                    minAmount0: 0,
                    minAmount1: 0,
                },
            ]);
        });

        it("should stake GLP", async () => {
            await wrappedLoan.stakeGLPYak(glpBalanceAfterMint);
        });

        it("should recover GLP", async () => {
            await recoveryManager.recoverAssets([{
                asset: toBytes32("YY_GLP"),
                underlying: (await tokenContracts.get('GLP')!).address,
                accounts: [wrappedLoan.address],
                token0: constants.AddressZero,
                token1: constants.AddressZero,
                minAmount0: 0,
                minAmount1: 0,
            }]);
        });

        it("should stake on YY", async () => {
            await wrappedLoan.stakeAVAXYak(toWei("10"));
            await wrappedLoan.stakeSAVAXYak(toWei('10'));
        });

        it("should recover assets from YY", async () => {
            await recoveryManager.recoverAssets([
                {
                    asset: toBytes32("YY_AAVE_AVAX"),
                    underlying: (await tokenContracts.get('AVAX')!).address,
                    accounts: [wrappedLoan.address],
                    token0: constants.AddressZero,
                    token1: constants.AddressZero,
                    minAmount0: 0,
                    minAmount1: 0,
                },
                {
                    asset: toBytes32("YY_PTP_sAVAX"),
                    underlying: (await tokenContracts.get('sAVAX')!).address,
                    accounts: [wrappedLoan.address],
                    token0: constants.AddressZero,
                    token1: constants.AddressZero,
                    minAmount0: 0,
                    minAmount1: 0,
                },
            ]);
        });

        async function testStake(stakeMethod: string, balanceMethod: string, stakingContractAddress: string, amount: BigNumber) {
            let initialNativeAVAXBalance = await provider.getBalance(loan.address);
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let stakingContract = await new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider);
            let compounder = IVectorFinanceCompounder__factory.connect(await stakingContract.compounder(), provider);

            let initialStakedBalance = await compounder.depositTracking(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await wrappedLoan[stakeMethod](amount);

            let postStakingNativeAVAXBalance = await provider.getBalance(loan.address);
            let extraAvaxAddedDollarValue = tokensPrices.get('AVAX')! * fromWei(postStakingNativeAVAXBalance.sub(initialNativeAVAXBalance))
            
            expect(await wrappedLoan[balanceMethod]()).to.be.closeTo(amount, 1);
            expect(await compounder.depositTracking(wrappedLoan.address)).to.be.eq(amount);


            expect(fromWei(await wrappedLoan.getTotalValue()) - + extraAvaxAddedDollarValue).to.be.closeTo(fromWei(initialTotalValue), 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue()) - extraAvaxAddedDollarValue * 0.833333333333333333).to.be.closeTo(fromWei(initialTWV), 0.0001);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.1);
        }
    });
});
