import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import { constructSimpleSDK, ContractMethod, SimpleFetchSDK, SwapSide } from '@paraswap/sdk';
import axios from 'axios';

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    calculateStakingTokensAmountBasedOnAvaxValue,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools, erc20ABI, fromBytes32,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei,
    parseParaSwapRouteData,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";
import web3Abi from "web3-eth-abi";

chai.use(solidity);

const {deployContract, provider} = waffle;
const ggAvaxTokenAddress = TOKEN_ADDRESSES['BAL_ggAVAX_WAVAX_BPT'];
const yyAvaxTokenAddress = TOKEN_ADDRESSES['BAL_yyAVAX_WAVAX_BPT'];

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            ggAvaxTokenContract: Contract,
            yyAvaxTokenContract: Contract,
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
            paraSwapMin: SimpleFetchSDK,
            tokensPrices: Map<string, number>;

        const getSwapData = async (srcToken: keyof typeof TOKEN_ADDRESSES, srcDecimals: number, destToken: keyof typeof TOKEN_ADDRESSES, destDecimals: number, srcAmount: any) => {
            const priceRoute = await paraSwapMin.swap.getRate({
                srcToken: TOKEN_ADDRESSES[srcToken],
                srcDecimals,
                destToken: TOKEN_ADDRESSES[destToken],
                destDecimals,
                amount: srcAmount.toString(),
                userAddress: wrappedLoan.address,
                side: SwapSide.SELL,
            });
            const txParams = await paraSwapMin.swap.buildTx({
                srcToken: priceRoute.srcToken,
                destToken: priceRoute.destToken,
                srcAmount: priceRoute.srcAmount,
                slippage: 300,
                priceRoute,
                userAddress: wrappedLoan.address,
                partner: 'anon',
            }, {
                ignoreChecks: true,
            });
            const swapData = parseParaSwapRouteData(txParams);
            return swapData;
        };

        before("deploy factory and pool", async () => {
            [owner, depositor, liquidator] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'ggAVAX', 'yyAVAX', 'USDC', 'BAL_ggAVAX_WAVAX_BPT', 'BAL_yyAVAX_WAVAX_BPT'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(
                ['AVAX', 'USDC', 'QI'],
                "avalanche",
                getRedstonePrices,
                [
                    //TODO: put price that makes sense
                    {symbol: 'ggAVAX', value: 5},
                    {symbol: 'yyAVAX', value: 11},
                    {symbol: 'BAL_ggAVAX_WAVAX_BPT', value: 1000},
                    {symbol: 'BAL_yyAVAX_WAVAX_BPT', value: 1000},
                ]
            );
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            ggAvaxTokenContract = await new ethers.Contract(ggAvaxTokenAddress, erc20ABI, provider);
            yyAvaxTokenContract = await new ethers.Contract(yyAvaxTokenAddress, erc20ABI, provider);

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

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

            await deployAllFacets(diamondAddress)

            paraSwapMin = constructSimpleSDK({chainId: 43114, axios});
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

        it("should fund a loan and swap to ggAVAX, yyAVAX", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1"));

            let swapData = await getSwapData('AVAX', 18, 'yyAVAX', 18, toWei('50'));
            await wrappedLoan.paraSwap(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('50'), TOKEN_ADDRESSES['yyAVAX'], 0);
            swapData = await getSwapData('AVAX', 18, 'ggAVAX', 18, toWei('50'));
            await wrappedLoan.paraSwap(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('50'), TOKEN_ADDRESSES['ggAVAX'], 0);

            //TODO: high slippage on Pangolin
            // expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(151 * tokensPrices.get('AVAX')! + 50 * tokensPrices.get('sAVAX')!, 0.01);
            // expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(167.5, 0.01);
        });

        it("should fail to stake as a non-owner", async () => {
            //https://docs.balancer.fi/reference/joins-and-exits/pool-joins.html#userdata
            await expect(nonOwnerWrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                    [
                        "0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3",
                        "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    ],
                    [
                        toWei("10"), //try with no
                        0
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]

            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake ggAVAX in Balancer vault", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await ggAvaxTokenContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                    [
                        "0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3",
                        "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    ],
                    [
                        toWei("10"), //try with no
                        0
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            );

            let balanceAfterStake = fromWei(await ggAvaxTokenContract.balanceOf(wrappedLoan.address));
            expect(balanceAfterStake).to.be.gt(0);

            //TODO: uncomment after RS feed is ready
            // expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 20);
            // expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 300);
        });

        it("should claim rewards", async () => {
            await expect(wrappedLoan.claimRewardsBalancerV2(
                "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
            )).not.to.be.reverted;
        });

        it("should not allow staking in a non-whitelisted Balancer vault", async () => {
            await expect(wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xb06fdbd2941d2f42d60accee85086198ac72923600020000000000000000001a",
                    [
                        "0x502580fc390606b47FC3b741d6D49909383c28a9",
                        "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    ],
                    [
                        0,
                        toWei("10")
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith('BalancerV2PoolNotWhitelisted');
        });

        it("should not allow staking a non-whitelisted asset", async () => {
            await expect(wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                    [
                        "0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3",
                        "0x7275c131b1f67e8b53b4691f92b0e35a4c1c6e22",
                    ],
                    [
                        0,
                        toWei("10")
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith('DepositingInactiveToken');
        });

        it("should unstake part of ggAVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeAndExitPoolBalancerV2(
                [
                    "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                    "0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3",
                    toWei("9"), //max. slippage = 10%,
                    await ggAvaxTokenContract.balanceOf(wrappedLoan.address)
                ]
            );

            //TODO: uncomment after RS feed is ready
            // expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 25);
            // expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            // expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });

        it("should stake yyAVAX in Balancer vault", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await yyAvaxTokenContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f",
                    [
                        "0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad9",
                        "0x0000000000000000000000000000000000000000",
                        "0xF7D9281e8e363584973F946201b82ba72C965D27",
                    ],
                    [
                        0,
                        0,
                        toWei("10"), //try with no
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            );

            let balanceAfterStake = fromWei(await yyAvaxTokenContract.balanceOf(wrappedLoan.address));
            expect(balanceAfterStake).to.be.gt(0);

            //TODO: uncomment after RS feed is ready
            // expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 20);
            // expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 300);
        });

        it("should claim rewards", async () => {
            await expect(wrappedLoan.claimRewardsBalancerV2(
                "0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f",
            )).not.to.be.reverted;
        });

        it("should not allow staking in a non-whitelisted Balancer vault", async () => {
            await expect(wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xb06fdbd2941d2f42d60accee85086198ac72923600020000000000000000001a",
                    [
                        "0x502580fc390606b47FC3b741d6D49909383c28a9",
                        "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    ],
                    [
                        0,
                        toWei("10")
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith('BalancerV2PoolNotWhitelisted');
        });

        it("should not allow staking a non-whitelisted asset", async () => {
            await expect(wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f",
                    [
                        "0xF7D9281e8e363584973F946201b82ba72C965D27",
                        "0x7275c131b1f67e8b53b4691f92b0e35a4c1c6e22",
                    ],
                    [
                        0,
                        toWei("10")
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith('DepositingInactiveToken');
        });

        it("should unstake part of yyAVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeAndExitPoolBalancerV2(
                [
                    "0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f",
                    "0xF7D9281e8e363584973F946201b82ba72C965D27",
                    toWei("9"), //max. slippage = 10%,
                    await yyAvaxTokenContract.balanceOf(wrappedLoan.address)
                ]
            );

            //TODO: uncomment after RS feed is ready
            // expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 25);
            // expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            // expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });
    });
});
