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
import {WrapperBuilder} from "redstone-evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    PangolinIntermediary,
    RedstoneConfigManager__factory,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TokenManager,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

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

const wavaxAbi = [
    'function deposit() public payable',
    ...erc20ABI
]
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
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
            let assetsList = ['AVAX', 'USDC', 'YYAV3SA1'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));
            await deployPools(poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            let tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                [
                    supportedAssets,
                    lendingPools
                ]
            ) as TokenManager;

            yakStakingContract = await new ethers.Contract(yakStakingTokenAddress, erc20ABI, provider);

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

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

            await deployAllFacets(diamondAddress)
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            wrappedLoan = WrapperBuilder
                .mockLite(loan)
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })

            nonOwnerWrappedLoan = WrapperBuilder
                .mockLite(loan.connect(depositor))
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })
        });

        it("should fund a loan", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(await wrappedLoan.getLTV()).to.be.equal(0);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(200 * tokensPrices.get('AVAX')!, 0.0001);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(await wrappedLoan.getLTV()).to.be.equal(0);
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

        it("should stake", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(200 * tokensPrices.get('AVAX')!, 0.0001);

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
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(150 * tokensPrices.get('AVAX')! + fromWei(afterStakingStakedBalance) * tokensPrices.get('YYAV3SA1')!, 1);
        });

        it("should unstake part of staked AVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialAvaxBalance = await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address);
            let amountAvaxToReceive = toWei("10");
            let initialStakedTokensBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
            let tokenAmountToUnstake = await calculateStakingTokensAmountBasedOnAvaxValue(yakStakingContract, amountAvaxToReceive);

            let expectedAfterUnstakeTokenBalance = initialStakedTokensBalance.sub(tokenAmountToUnstake);

            await wrappedLoan.unstakeAVAXYak(tokenAmountToUnstake);

            expect(expectedAfterUnstakeTokenBalance).to.be.equal(await yakStakingContract.balanceOf(wrappedLoan.address));
            expect(fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address))).to.be.closeTo(fromWei(initialAvaxBalance.add(amountAvaxToReceive)), 0.3);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);
        });

        it("should fail to unstake more than was initially staked", async () => {
            await expect(wrappedLoan.unstakeAVAXYak(toWei("999999"))).to.be.revertedWith("Cannot unstake more than was initially staked");
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
            tokensPrices: Map<string, number>;

        before("deploy provider, exchange and pool", async () => {
            [owner, depositor, liquidator] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'YYAV3SA1'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));
            await deployPools(poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            yakStakingContract = await new ethers.Contract(yakStakingTokenAddress, erc20ABI, provider);

            let tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                [
                    supportedAssets,
                    lendingPools
                ]
            ) as TokenManager;

            let diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

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

            exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

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

        it("should deploy a smart loan, fund, borrow and invest", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            wrappedLoan = WrapperBuilder
                .mockLite(loan)
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(400 * tokensPrices.get('AVAX')!, 0.1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300 * tokensPrices.get('AVAX')!, 0.1);
            expect(await wrappedLoan.getLTV()).to.be.equal(3000);

            const slippageTolerance = 0.03;

            let usdAmount = Math.floor(30 * tokensPrices.get('AVAX')!);
            let requiredAvaxAmount = tokensPrices.get('USDC')! * usdAmount * (1 + slippageTolerance) / tokensPrices.get('AVAX')!;

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei(requiredAvaxAmount.toString()),
                parseUnits(usdAmount.toString(), await tokenContracts.get('USDC')!.decimals()),
            );

            await wrappedLoan.stakeAVAXYak(
                toWei("305")
            );
        });

        it("should withdraw collateral and part of borrowed funds, bring prices back to normal and liquidate the loan by supplying additional AVAX", async () => {
            // Define "updated" (USDC x 1000) prices and build an updated wrapped loan
            MOCK_PRICES_UPDATED = [
                {
                    symbol: 'USDC',
                    value: tokensPrices.get('USDC')! * 1000
                },
                {
                    symbol: 'AVAX',
                    value: tokensPrices.get('AVAX')!
                },
                {
                    symbol: 'YYAV3SA1',
                    value: tokensPrices.get('YYAV3SA1')!
                }
            ]

            wrappedLoanUpdated = WrapperBuilder
                .mockLite(loan)
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES_UPDATED,
                            timestamp: Date.now()
                        }
                    })

            // Withdraw funds using the updated prices and make sure the "standard" wrappedLoan is Insolvent as a consequence
            expect(await wrappedLoan.isSolvent()).to.be.true;
            await wrappedLoanUpdated.withdraw(toBytes32("AVAX"), toWei("60"));
            expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
            expect(await wrappedLoan.isSolvent()).to.be.false;


            let wrappedLoanLiquidator = WrapperBuilder
                .mockLite(loan.connect(liquidator))
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })

            let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);

            let allowance = toWei("150");
            await tokenContracts.get('AVAX')!.connect(liquidator).approve(wrappedLoan.address, allowance);
            await tokenContracts.get('AVAX')!.connect(liquidator).deposit({value: allowance});

            await wrappedLoanLiquidator.liquidateLoan([toBytes32("AVAX")], [toWei("150")], 50);
            let currentStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);

            expect(fromWei(initialStakedBalance)).to.be.greaterThan(fromWei(currentStakedBalance));
            expect(fromWei(currentStakedBalance)).to.be.greaterThan(0);
            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });
});

