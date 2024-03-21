import {ethers, waffle} from 'hardhat'
import chai, {expect, util} from 'chai'
import {solidity} from "ethereum-waffle";
import { constructSimpleSDK, SimpleFetchSDK, SwapSide, ContractMethod } from '@paraswap/sdk';
import axios from 'axios';

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import liquidityRouterInterface from '../../abis/LevelFinanceLiquidityRouter.json';
import ILevelFinanceArtifact
    from '../../../artifacts/contracts/interfaces/facets/arbitrum/ILevelFinance.sol/ILevelFinance.json';
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
    erc20ABI,
    fromBytes32,
    fromWei,
    formatUnits,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    LPAbi,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    time,
    toBytes32,
    toWei,
    parseParaSwapRouteData,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    SushiSwapIntermediary,
} from "../../../typechain";
import {BigNumber, BigNumberish, Contract, constants} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/arbitrum/token_addresses.json';
import { parseUnits, parseEther } from 'ethers/lib/utils'

chai.use(solidity);

const {deployContract, provider} = waffle;

const pendleApiBaseUrl = "https://api-v2.pendle.finance/sdk/api";

const ezETHMarket = "0x60712e3C9136CF411C561b4E948d4d26637561e7";
const wstETHMarket = "0x08a152834de126d2ef83D612ff36e4523FD0017F";
const eETHMarket = "0xE11f9786B06438456b044B3E21712228ADcAA0D1";
const rsETHMarket = "0x6F02C88650837C8dfe89F66723c4743E9cF833cd";
const wstETHSiloMarket = "0xACcd9A7cb5518326BeD715f90bD32CDf2fEc2D14";
const eETHSiloMarket = "0x99e9028e274FEAFA2E1D8787E1eE6DE39C6F7724";

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with Penpie staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            wstEthBalance: BigNumber,
            weEthBalance: BigNumber,
            rsEthBalance: BigNumber,
            tokenManager: MockTokenManager,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            owner: SignerWithAddress,
            nonOwner: SignerWithAddress,
            depositor: SignerWithAddress,
            paraSwapMin: SimpleFetchSDK,
            liquidityRouter: Contract,
            MOCK_PRICES: any,
            diamondAddress: any;

        const getSwapData = async (srcToken: keyof typeof TOKEN_ADDRESSES, destToken: keyof typeof TOKEN_ADDRESSES, srcDecimals: number, destDecimals: number, srcAmount: any) => {
            const priceRoute = await paraSwapMin.swap.getRate({
                srcToken: TOKEN_ADDRESSES[srcToken],
                destToken: TOKEN_ADDRESSES[destToken],
                srcDecimals,
                destDecimals,
                amount: srcAmount.toString(),
                userAddress: wrappedLoan.address,
                side: SwapSide.SELL,
                options: {
                    includeContractMethods: [ContractMethod.simpleSwap]
                }
            });
            const txParams = await paraSwapMin.swap.buildTx({
                srcToken: priceRoute.srcToken,
                destToken: priceRoute.destToken,
                srcDecimals,
                destDecimals,
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
            paraSwapMin = constructSimpleSDK({ chainId: 42161, axios });

            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            let penpieLpTokens = ['PENPIE_EZETH_LP', 'PENPIE_WSTETH_LP', 'PENPIE_EETH_LP', 'PENPIE_RSETH_LP', 'PENPIE_WSTETHSILO_LP', 'PENPIE_EETHSILO_LP'];
            let assetsList = ['ETH', 'ezETH', 'wstETH', 'weETH', 'rsETH', 'PNP', ...penpieLpTokens];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'ETH', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 1000, 'ARBITRUM');

            tokensPrices = await getTokensPricesMap(assetsList.filter(el => !(['PNP', 'ezETH', 'weETH', 'rsETH', ...penpieLpTokens].includes(el))), "arbitrum", getRedstonePrices, [
                {symbol: 'PNP', value: 2.75},
                {symbol: 'ezETH', value: 3500},
                {symbol: 'weETH', value: 3500},
                {symbol: 'rsETH', value: 3500},
                ...penpieLpTokens.map(symbol => ({
                    symbol, value: 7500
                })),
            ]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList, 'ARBITRUM');
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, [], 'ARBITRUM');

            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await tokenManager.setIdentifiersToExposureGroups([toBytes32("ETH")], [toBytes32("ETH_GROUP")]);
            await tokenManager.setMaxProtocolsExposure([toBytes32("ETH_GROUP")], [toWei("5000")]);
            await tokenManager.setIdentifiersToExposureGroups([toBytes32("ezETH")], [toBytes32("ezETH_GROUP")]);
            await tokenManager.setMaxProtocolsExposure([toBytes32("ezETH_GROUP")], [toWei("5000")]);
            await tokenManager.setIdentifiersToExposureGroups([toBytes32("wstETH")], [toBytes32("wstETH_GROUP")]);
            await tokenManager.setMaxProtocolsExposure([toBytes32("wstETH_GROUP")], [toWei("5000")]);
            await tokenManager.setIdentifiersToExposureGroups([toBytes32("weETH")], [toBytes32("weETH_GROUP")]);
            await tokenManager.setMaxProtocolsExposure([toBytes32("weETH_GROUP")], [toWei("5000")]);
            await tokenManager.setIdentifiersToExposureGroups([toBytes32("rsETH")], [toBytes32("rsETH_GROUP")]);
            await tokenManager.setMaxProtocolsExposure([toBytes32("rsETH_GROUP")], [toWei("5000")]);
            await tokenManager.setIdentifiersToExposureGroups([toBytes32("PENPIE_EZETH_LP")], [toBytes32("PENPIE_EZETH_LP_GROUP")]);
            await tokenManager.setMaxProtocolsExposure([toBytes32("PENPIE_EZETH_LP_GROUP")], [toWei("5000")]);
            await tokenManager.setIdentifiersToExposureGroups([toBytes32("PENPIE_WSTETH_LP")], [toBytes32("PENPIE_WSTETH_LP_GROUP")]);
            await tokenManager.setMaxProtocolsExposure([toBytes32("PENPIE_WSTETH_LP_GROUP")], [toWei("5000")]);
            await tokenManager.setIdentifiersToExposureGroups([toBytes32("PENPIE_EETH_LP")], [toBytes32("PENPIE_EETH_LP_GROUP")]);
            await tokenManager.setMaxProtocolsExposure([toBytes32("PENPIE_EETH_LP_GROUP")], [toWei("5000")]);
            await tokenManager.setIdentifiersToExposureGroups([toBytes32("PENPIE_RSETH_LP")], [toBytes32("PENPIE_RSETH_LP_GROUP")]);
            await tokenManager.setMaxProtocolsExposure([toBytes32("PENPIE_RSETH_LP_GROUP")], [toWei("5000")]);
            await tokenManager.setIdentifiersToExposureGroups([toBytes32("PENPIE_WSTETHSILO_LP")], [toBytes32("PENPIE_WSTETHSILO_LP_GROUP")]);
            await tokenManager.setMaxProtocolsExposure([toBytes32("PENPIE_WSTETHSILO_LP_GROUP")], [toWei("5000")]);
            await tokenManager.setIdentifiersToExposureGroups([toBytes32("PENPIE_EETHSILO_LP")], [toBytes32("PENPIE_EETHSILO_LP_GROUP")]);
            await tokenManager.setMaxProtocolsExposure([toBytes32("PENPIE_EETHSILO_LP_GROUP")], [toWei("5000")]);

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
                'lib',
                5000,
                "1.042e18",
                200,
                "ETH",
                "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
            );

            await deployAllFacets(diamondAddress, true, 'ARBITRUM');
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

        it("should swap and fund", async () => {
            await tokenContracts.get('ETH')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('ETH')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("ETH"), toWei("100"));

            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let swapData = await getSwapData('ETH', 'wstETH', 18, 18, toWei('2'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], toWei('2'), TOKEN_ADDRESSES['wstETH'], 1);
            wstEthBalance = await tokenContracts.get('wstETH')!.balanceOf(wrappedLoan.address);

            swapData = await getSwapData('ETH', 'weETH', 18, 18, toWei('2'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], toWei('2'), TOKEN_ADDRESSES['weETH'], 1);
            weEthBalance = await tokenContracts.get('weETH')!.balanceOf(wrappedLoan.address);

            swapData = await getSwapData('ETH', 'rsETH', 18, 18, toWei('2'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], toWei('2'), TOKEN_ADDRESSES['rsETH'], 1);
            rsEthBalance = await tokenContracts.get('rsETH')!.balanceOf(wrappedLoan.address);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 500);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(fromWei(initialHR));
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 500);
        });

        it("should fail to stake as a non-owner", async () => {
            const mockArgs = [
                toBytes32("ETH"),
                0,
                ethers.constants.AddressZero,
                0,
                {
                    guessMin: 0,
                    guessMax: 0,
                    guessOffchain: 0,
                    maxIteration: 0,
                    eps: 0,
                },
                {
                    tokenIn: ethers.constants.AddressZero,
                    netTokenIn: 0,
                    tokenMintSy: ethers.constants.AddressZero,
                    pendleSwap:  ethers.constants.AddressZero,
                    swapData: {
                        swapType: 0,
                        extRouter: ethers.constants.AddressZero,
                        extCalldata: "0x",
                        needScale: false
                    }
                },
                {
                    limitRouter: ethers.constants.AddressZero,
                    epsSkipMarket: 0,
                    normalFills: [],
                    flashFills: [],
                    optData: "0x"
                }
            ];
            await expect(nonOwnerWrappedLoan.stakePenpie(...mockArgs)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake as a non-owner", async () => {
            const mockArgs = [
                toBytes32("ETH"),
                0,
                ethers.constants.AddressZero,
                0,
                {
                    tokenOut: ethers.constants.AddressZero,
                    minTokenOut: 0,
                    tokenRedeemSy: ethers.constants.AddressZero,
                    pendleSwap: ethers.constants.AddressZero,
                    swapData: {
                        swapType: 0,
                        extRouter: ethers.constants.AddressZero,
                        extCalldata: "0x",
                        needScale: false
                    }
                },
                {
                    limitRouter: ethers.constants.AddressZero,
                    epsSkipMarket: 0,
                    normalFills: [],
                    flashFills: [],
                    optData: "0x"
                }
            ];
            await expect(nonOwnerWrappedLoan.unstakePenpie(...mockArgs)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake", async () => {
            await testStake("ETH", ezETHMarket, toWei('2'), 1, "PENPIE_EZETH_LP");
            await testStake("wstETH", wstETHMarket, wstEthBalance, 1, "PENPIE_WSTETH_LP");
            await testStake("weETH", eETHMarket, weEthBalance, 1, "PENPIE_EETH_LP");
            await testStake("rsETH", rsETHMarket, rsEthBalance, 1, "PENPIE_RSETH_LP");
            await testStake("ETH", wstETHSiloMarket, toWei('2'), 1, "PENPIE_WSTETHSILO_LP");
            await testStake("ETH", eETHSiloMarket, toWei('2'), 1, "PENPIE_EETHSILO_LP");
        });

        it("should unstake", async () => {
            let ezEthLpBalance = await tokenContracts.get('PENPIE_EZETH_LP')!.balanceOf(wrappedLoan.address);
            let wstEthLpBalance = await tokenContracts.get('PENPIE_WSTETH_LP')!.balanceOf(wrappedLoan.address);
            let eEthLpBalance = await tokenContracts.get('PENPIE_EETH_LP')!.balanceOf(wrappedLoan.address);
            let rsEthLpBalance = await tokenContracts.get('PENPIE_RSETH_LP')!.balanceOf(wrappedLoan.address);
            let wstEthSiloLpBalance = await tokenContracts.get('PENPIE_WSTETHSILO_LP')!.balanceOf(wrappedLoan.address);
            let eEthSiloLpBalance = await tokenContracts.get('PENPIE_EETHSILO_LP')!.balanceOf(wrappedLoan.address);

            await testUnstake("ezETH", ezETHMarket, ezEthLpBalance, 1, "PENPIE_EZETH_LP");
            await testUnstake("wstETH", wstETHMarket, wstEthLpBalance, 1, "PENPIE_WSTETH_LP");
            await testUnstake("weETH", eETHMarket, eEthLpBalance, 1, "PENPIE_EETH_LP");
            await testUnstake("rsETH", rsETHMarket, rsEthLpBalance, 1, "PENPIE_RSETH_LP");
            await testUnstake("ETH", wstETHSiloMarket, wstEthSiloLpBalance, 1, "PENPIE_WSTETHSILO_LP");
            await testUnstake("ETH", eETHSiloMarket, eEthSiloLpBalance, 1, "PENPIE_EETHSILO_LP");
        });

        async function testStake(asset: string, market: string, amount: BigNumber, minLpOut: BigNumberish, lpToken: string) {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            const queryParams = new URLSearchParams({
                chainId: "42161",
                receiverAddr: wrappedLoan.address,
                marketAddr: market,
                tokenInAddr: TOKEN_ADDRESSES[asset],
                amountTokenIn: amount.toString(),
                slippage: "0.05"
            });
            const { data: { contractCallParams: { 3: guessPtReceivedFromSy, 4: input, 5: limit } } } = await axios.get(`${pendleApiBaseUrl}/v1/addLiquiditySingleToken?${queryParams}`);

            const beforeLpExposure = await getAssetExposure(lpToken);
            const beforeTokenExposure = await getAssetExposure(asset);

            await wrappedLoan.stakePenpie(toBytes32(asset), amount, market, minLpOut, guessPtReceivedFromSy, input, limit);

            expect(await loanOwnsAsset(lpToken)).to.be.true;
            const afterLpExposure = await getAssetExposure(lpToken);
            const afterTokenExposure = await getAssetExposure(asset);

            expect(beforeTokenExposure.current.sub(afterTokenExposure.current)).to.be.eq(amount);
            expect(afterLpExposure.current).to.be.gt(beforeLpExposure.current);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 1600);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.0001);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 1600);
        }

        async function testUnstake(asset: string, market: string, amount: BigNumber, minOut: BigNumberish, lpToken: string) {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();

            const queryParams = new URLSearchParams({
                chainId: "42161",
                receiverAddr: wrappedLoan.address,
                marketAddr: market,
                amountLpToRemove: amount.toString(),
                tokenOutAddr: TOKEN_ADDRESSES[asset],
                slippage: "0.05"
            });
            const { data: { contractCallParams: { 3: output, 4: limit } } } = await axios.get(`${pendleApiBaseUrl}/v1/removeLiquiditySingleToken?${queryParams}`);

            const beforeLpExposure = await getAssetExposure(lpToken);
            const beforeTokenExposure = await getAssetExposure(asset);

            await wrappedLoan.unstakePenpie(toBytes32(asset), amount, market, minOut, output, limit);

            expect(await loanOwnsAsset(lpToken)).to.be.false;
            const afterLpExposure = await getAssetExposure(lpToken);
            const afterTokenExposure = await getAssetExposure(asset);

            expect(beforeLpExposure.current.sub(afterLpExposure.current)).to.be.eq(amount);
            expect(afterTokenExposure.current).to.be.gt(beforeTokenExposure.current);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 1600);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.01);
        }

        async function loanOwnsAsset(asset: string) {
            let ownedAssets =  await wrappedLoan.getAllOwnedAssets();
            for(const ownedAsset of ownedAssets){
                if(fromBytes32(ownedAsset) == asset){
                    return true;
                }
            }
            return false;
        }

        async function getAssetExposure(asset: string) {
            const group = await tokenManager.identifierToExposureGroup(toBytes32(asset));
            const exposure = await tokenManager.groupToExposure(group);
            return exposure;
        }
    });
});
