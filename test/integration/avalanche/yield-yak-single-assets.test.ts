import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    calculateStakingTokensAmountBasedOnAvaxValue,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
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
import {PangolinIntermediary, SmartLoanGigaChadInterface, SmartLoansFactory, TokenManager,} from "../../../typechain";
import {Contract} from "ethers";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract, provider} = waffle;
const yakStakingTokenAddress = "0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95";

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function totalSupply() external view returns (uint256)',
    'function totalDeposits() external view returns (uint256)'
]

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            exchange: PangolinIntermediary,
            yakStakingContract: Contract,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            diamondAddress: any,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'sAVAX', 'YY_AAVE_AVAX', 'YY_PTP_sAVAX'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            let tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                []
            ) as TokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);

            yakStakingContract = await new ethers.Contract(yakStakingTokenAddress, erc20ABI, provider);

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
                .wrap(loan.connect(depositor))
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

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(201 * tokensPrices.get('AVAX')!, 0.0001);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(167.5, 0.01);
        });

        it("should fail to stake AVAX as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeAVAXYak(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake AVAX as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeAVAXYak(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to stake sAVAX as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeSAVAXYak(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake sAVAX as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeSAVAXYak(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake AVAX", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(201 * tokensPrices.get('AVAX')!, 0.0001);

            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeAVAXYak(toWei("9999"), {gasLimit: 8000000})).to.be.revertedWith("Not enough AVAX available");

            const stakedAvaxAmount = 50;

            await wrappedLoan.stakeAVAXYak(
                toWei(stakedAvaxAmount.toString())
            );

            let afterStakingStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
            let expectedAfterStakingStakedBalance = await calculateStakingTokensAmountBasedOnAvaxValue(yakStakingContract, toWei(stakedAvaxAmount.toString()));

            expect(afterStakingStakedBalance).to.be.equal(expectedAfterStakingStakedBalance);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(151 * tokensPrices.get('AVAX')! + fromWei(afterStakingStakedBalance) * tokensPrices.get('YY_AAVE_AVAX')!, 1);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 0.5);
        });

        it("should unstake part of staked AVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialAvaxBalance = await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address);
            let amountAvaxToReceive = toWei("10");
            let initialStakedTokensBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
            let tokenAmountToUnstake = await calculateStakingTokensAmountBasedOnAvaxValue(yakStakingContract, amountAvaxToReceive);

            let expectedAfterUnstakeTokenBalance = initialStakedTokensBalance.sub(tokenAmountToUnstake);

            await wrappedLoan.unstakeAVAXYak(tokenAmountToUnstake);

            expect(expectedAfterUnstakeTokenBalance).to.be.equal(await yakStakingContract.balanceOf(wrappedLoan.address));
            expect(fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address))).to.be.closeTo(fromWei(initialAvaxBalance.add(amountAvaxToReceive)), 0.4);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 0.1);
        });

        it("should not fail to unstake more than was initially staked but unstake all", async () => {
            await wrappedLoan.unstakeAVAXYak(toWei("999999"));
            expect(await yakStakingContract.balanceOf(wrappedLoan.address)).to.be.equal(0);
        });

        it("should stake sAVAX", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(201 * tokensPrices.get('AVAX')!, 0.0001);

            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeSAVAXYak(toWei("9999"), {gasLimit: 8000000})).to.be.revertedWith("Not enough token available");

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('sAVAX'),
                toWei('50'),
                0,
            );

            const savaxAmount = await wrappedLoan.getBalance(toBytes32('sAVAX'));
            expect(savaxAmount).to.be.gt(0);

            await wrappedLoan.stakeSAVAXYak(
                savaxAmount
            );

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 2);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 15);
        });

        it("should unstake sAVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeSAVAXYak(await wrappedLoan.getBalance(toBytes32('YY_PTP_sAVAX')));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 0.1);
        });
    });

    describe('A loan with staking liquidation', () => {
        let exchange: PangolinIntermediary,
            loan: SmartLoanGigaChadInterface,
            smartLoansFactory: SmartLoansFactory,
            wrappedLoan: any,
            wrappedLoanUpdated: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            liquidator: SignerWithAddress,
            yakStakingContract: Contract,
            MOCK_PRICES: any,
            MOCK_PRICES_UPDATED: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            diamondAddress: string,
            tokensPrices: Map<string, number>;

        before("deploy provider, exchange and pool", async () => {
            [owner, depositor, liquidator] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'YY_AAVE_AVAX'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            yakStakingContract = await new ethers.Contract(yakStakingTokenAddress, erc20ABI, provider);

            let tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                []
            ) as TokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

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

        it("should deploy a smart loan, fund, borrow and invest", async () => {
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

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(400 * tokensPrices.get('AVAX')!, 0.1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300 * tokensPrices.get('AVAX')!, 0.1);

            let debt = 300 * tokensPrices.get('AVAX')!;
            let maxDebt = 0.833333 * 400 * tokensPrices.get('AVAX')!;

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(maxDebt /debt, 0.01);

            const slippageTolerance = 0.03;

            let usdAmount = Math.floor(30 * tokensPrices.get('AVAX')!);
            let requiredAvaxAmount = tokensPrices.get('USDC')! * usdAmount * (1 + slippageTolerance) / tokensPrices.get('AVAX')!;

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei(requiredAvaxAmount.toString()),
                parseUnits(usdAmount.toString(), await tokenContracts.get('USDC')!.decimals()),
            );
        });

        it("should stake in YieldYak", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            await wrappedLoan.stakeAVAXYak(
                toWei("305")
            );

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 3);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 2);
        });

        it("should withdraw collateral and part of borrowed funds, bring prices back to normal and liquidate the loan by supplying additional AVAX", async () => {
            // Define "updated" (USDC x 1000) prices and build an updated wrapped loan
            MOCK_PRICES_UPDATED = [
                {
                    dataFeedId: 'USDC',
                    value: tokensPrices.get('USDC')! * 1000
                },
                {
                    dataFeedId: 'AVAX',
                    value: tokensPrices.get('AVAX')!
                },
                {
                    dataFeedId: 'YY_AAVE_AVAX',
                    value: tokensPrices.get('YY_AAVE_AVAX')!
                }
            ]

            wrappedLoanUpdated = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES_UPDATED,
                });

            // Withdraw funds using the updated prices and make sure the "standard" wrappedLoan is Insolvent as a consequence
            expect(await wrappedLoan.isSolvent()).to.be.true;

            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['canRepayDebtFully']);
            await diamondCut.unpause();

            await wrappedLoanUpdated.withdraw(toBytes32("AVAX"), toWei("60"));

            expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
            expect(await wrappedLoan.isSolvent()).to.be.false;

            let wrappedLoanLiquidator = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(liquidator))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);

            let allowance = toWei("150");
            await tokenContracts.get('AVAX')!.connect(liquidator).approve(wrappedLoan.address, allowance);
            await tokenContracts.get('AVAX')!.connect(liquidator).deposit({value: allowance});

            let liquidatorsList = await ethers.getContractAt('ISmartLoanLiquidationFacet', diamondAddress, owner);
            await liquidatorsList.whitelistLiquidators([liquidator.address]);
            expect(await liquidatorsList.isLiquidatorWhitelisted(liquidator.address)).to.be.true;

            await wrappedLoanLiquidator.liquidateLoan([toBytes32("AVAX")], [toWei("150")], 50);
            let currentStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);

            expect(fromWei(initialStakedBalance)).to.be.greaterThan(fromWei(currentStakedBalance));
            expect(fromWei(currentStakedBalance)).to.be.greaterThan(0);
            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });
});

