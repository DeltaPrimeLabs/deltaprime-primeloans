import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    calculateStakingTokensAmountBasedOnAvaxValue,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools, erc20ABI,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei,
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
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";

chai.use(solidity);

const {deployContract, provider} = waffle;
const curveTokenAddress = TOKEN_ADDRESSES['crvUSDBTCETH'];
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            exchange: PangolinIntermediary,
            curveTokenContract: Contract,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            liquidator: SignerWithAddress,
            diamondAddress: any,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory and pool", async () => {
            [owner, depositor, liquidator] = await getFixedGasSigners(10000000);
            let assetsList = ['DAIe', 'USDCe', 'USDTe', 'WBTCe', 'ETH', 'AVAX', 'crvUSDBTCETH'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(
                ['ETH', 'AVAX'],
                getRedstonePrices,
                [
                    {symbol: 'DAIe', value: 1},
                    {symbol: 'USDCe', value: 1},
                    {symbol: 'USDTe', value: 1},
                    {symbol: 'WBTCe', value: 20000},
                    {symbol: 'crvUSDBTCETH', value: 1000},
                ]
            );
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            curveTokenContract = await new ethers.Contract(curveTokenAddress, erc20ABI, provider);

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

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
                .wrap(loan.connect(liquidator))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should fund a loan", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(201 * tokensPrices.get('AVAX')!, 0.01);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(167.5, 0.01);
        });

        it("should fail to stake DAI as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeDAICurve(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake DAI as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeDAICurve(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to stake USDC as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeUSDCCurve(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake USDC as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeUSDCCurve(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to stake USDT as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeUSDTCurve(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake USDT as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeUSDTCurve(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to stake WBTC as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeWBTCCurve(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake WBTC as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeWBTCCurve(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to stake ETH as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeETHCurve(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake ETH as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeETHCurve(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake DAI", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await curveTokenContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeDAICurve(toWei("9999"))).to.be.revertedWith("Cannot stake 0 tokens");

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('DAIe'),
                toWei('20'),
                0,
            );

            expect(await wrappedLoan.getBalance(toBytes32('DAIe'))).to.be.gt(0);

            // Should stake max if amount > balance
            await wrappedLoan.stakeDAICurve(toWei("99999999"));
            expect(await wrappedLoan.getBalance(toBytes32('DAIe'))).to.be.eq(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });

        it("should unstake DAI", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeDAICurve(toWei("99999999"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 25);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });

        it("should stake USDC", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await curveTokenContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeUSDCCurve(toWei("9999"))).to.be.revertedWith("Cannot stake 0 tokens");

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDCe'),
                toWei('20'),
                0,
            );

            expect(await wrappedLoan.getBalance(toBytes32('USDCe'))).to.be.gt(0);

            // Should stake max if amount > balance
            await wrappedLoan.stakeUSDCCurve(toWei("99999999"));
            expect(await wrappedLoan.getBalance(toBytes32('USDCe'))).to.be.eq(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });

        it("should unstake USDC", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeUSDCCurve(toWei("99999999"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 25);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });

        it("should stake USDT", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await curveTokenContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeUSDTCurve(toWei("9999"))).to.be.revertedWith("Cannot stake 0 tokens");

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDTe'),
                toWei('20'),
                0,
            );

            expect(await wrappedLoan.getBalance(toBytes32('USDTe'))).to.be.gt(0);

            // Should stake max if amount > balance
            await wrappedLoan.stakeUSDTCurve(toWei("99999999"));
            expect(await wrappedLoan.getBalance(toBytes32('USDTe'))).to.be.eq(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });

        it("should unstake USDT", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeUSDTCurve(toWei("99999999"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 25);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });

        it("should stake WBTC", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await curveTokenContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeWBTCCurve(toWei("9999"))).to.be.revertedWith("Cannot stake 0 tokens");

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('WBTCe'),
                toWei('20'),
                0,
            );

            expect(await wrappedLoan.getBalance(toBytes32('WBTCe'))).to.be.gt(0);

            // Should stake max if amount > balance
            await wrappedLoan.stakeWBTCCurve(toWei("99999999"));
            expect(await wrappedLoan.getBalance(toBytes32('WBTCe'))).to.be.eq(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });

        it("should unstake WBTC", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeWBTCCurve(toWei("99999999"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 25);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });

        it("should stake ETH", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await curveTokenContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeETHCurve(toWei("9999"))).to.be.revertedWith("Cannot stake 0 tokens");

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('ETH'),
                toWei('20'),
                0,
            );

            expect(await wrappedLoan.getBalance(toBytes32('ETH'))).to.be.gt(0);

            // Should stake max if amount > balance
            await wrappedLoan.stakeETHCurve(toWei("99999999"));
            expect(await wrappedLoan.getBalance(toBytes32('ETH'))).to.be.eq(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });

        it("should unstake ETH", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeETHCurve(toWei("99999999"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 25);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });
    });
});
