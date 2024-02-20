import {ethers, waffle} from 'hardhat'
import chai, {expect, util} from 'chai'
import {solidity} from "ethereum-waffle";
import { constructSimpleSDK, SimpleFetchSDK, SwapSide, ContractMethod } from '@paraswap/sdk';
import axios from 'axios';
import { parseUnits } from 'ethers/lib/utils'
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import DepositHandler from "@gmx-v2/deployments/arbitrum/DepositHandler.json";
import DataStore from "@gmx-v2/deployments/arbitrum/DataStore.json";
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
    getDepositKeys,
    getDepositCount,
    hashString,
    encodeRealtimeData,
    expandDecimals,
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
import {BigNumber, Contract, Signer} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/arbitrum/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;


const getBaseRealtimeDataForBlockRange = (lowerBlock, upperBlock, price) => {
    return {
      observationsTimestamp: upperBlock.timestamp,
      median: expandDecimals(price, 8),
      blocknumberUpperBound: upperBlock.number,
      upperBlockhash: upperBlock.hash,
      blocknumberLowerBound: lowerBlock.number,
      currentBlockTimestamp: upperBlock.timestamp,
    };
  };

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with Gmx V2 LP operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            btcBalance: BigNumber,
            usdtBalance: BigNumber,
            usdcBalance: BigNumber,
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
            dataStore: Contract,
            depositHandler: Contract,
            orderKeeper: Signer,
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
            let assetsList = ['ETH', 'BTC', 'USDT', 'USDC', 'GM_ETH_WETH_USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'ETH', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 1000, 'ARBITRUM');

            tokensPrices = await getTokensPricesMap(assetsList, "arbitrum", getRedstonePrices, [{symbol: 'LVL', value: 1}]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList, 'ARBITRUM');
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, [], 'ARBITRUM');

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
                'lib',
                5000,
                "1.042e18",
                100,
                "ETH",
                "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
            );

            await deployAllFacets(diamondAddress, true, 'ARBITRUM');
            dataStore = await ethers.getContractAt(DataStore.abi, DataStore.address);
            depositHandler = await ethers.getContractAt(DepositHandler.abi, DepositHandler.address);

            // GMX Order Keeper
            orderKeeper = await ethers.getImpersonatedSigner("0xf1e1b2f4796d984ccb8485d43db0c64b83c1fa6d");

        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();
            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);


            for(const mckPrice of MOCK_PRICES){
                console.log(`MCK PRICE: ${Object.entries(mckPrice)}`)
            }
            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 3,
                    dataPoints: MOCK_PRICES,
                });

            nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(nonOwner))
                .usingSimpleNumericMock({
                    mockSignersCount: 3,
                    dataPoints: MOCK_PRICES,
                });
        });


        it("should swap and fund", async () => {
            await tokenContracts.get('ETH')!.connect(owner).deposit({value: toWei("10")});
            await tokenContracts.get('ETH')!.connect(owner).approve(wrappedLoan.address, toWei("10"));
            await wrappedLoan.fund(toBytes32("ETH"), toWei("10"));

            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let swapData = await getSwapData('ETH', 'USDT', 18, 6, toWei('2'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], toWei('2'), TOKEN_ADDRESSES['USDT'], parseUnits((tokensPrices.get("ETH")! * 1.96).toFixed(6), 6));
            usdtBalance = await tokenContracts.get('USDT')!.balanceOf(wrappedLoan.address);
            swapData = await getSwapData('ETH', 'USDC', 18, 6, toWei('2'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], toWei('2'), TOKEN_ADDRESSES['USDC'], parseUnits((tokensPrices.get("ETH")! * 1.96).toFixed(6), 6));
            usdcBalance = await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(fromWei(initialHR));
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 20);
        });

        it("should deposit one asset to GMX V2", async () => {
            const tokenAmount = toWei('0.05');
            const maxFee = toWei('0.01');
            const estimateOutput = (0.05 * tokensPrices.get("ETH")!) / tokensPrices.get("GM_ETH_WETH_USDC")!;
            
            await expect(wrappedLoan.depositEthUsdcGmxV2(tokenAmount, 0, 0, maxFee, { value: maxFee })).to.be.revertedWith("Invalid min output value");
            
            await wrappedLoan.depositEthUsdcGmxV2(tokenAmount, 0, toWei(estimateOutput.toString()), maxFee, { value: maxFee })

            let depositCount = await getDepositCount(dataStore);
            console.log("Total Depsit Count:", depositCount);

            const depositKey = await getDepositKeys(dataStore, 0, 1);
            console.log("Deposit Key", depositKey);

            const block = await provider.getBlock();
            const block0 = await provider.getBlock(block.number - 5);
            const block1 = await provider.getBlock(block.number - 4);
            const block2 = await provider.getBlock(block.number - 3);
            const block3 = await provider.getBlock(block.number - 2);
            const block4 = await provider.getBlock(block.number - 1);
            const block5 = block;
            console.log(encodeRealtimeData({
                ...getBaseRealtimeDataForBlockRange(block0, block3, parseInt(tokensPrices.get("ETH")?.toString() || "0")),
                feedId: hashString("ETH"),
                bid: expandDecimals(parseInt(tokensPrices.get("ETH")?.toString() || "0"), 8),
                ask: expandDecimals(parseInt(tokensPrices.get("ETH")?.toString() || "0"), 8),
            }));

            const oracleParm = {
                signerInfo: 0,
                tokens: [],
                compactedMinOracleBlockNumbers: [],
                compactedMaxOracleBlockNumbers: [],
                compactedOracleTimestamps: [],
                compactedDecimals: [],
                compactedMinPrices: [],
                compactedMinPricesIndexes: [],
                compactedMaxPrices: [],
                compactedMaxPricesIndexes: [],
                signatures: [],
                priceFeedTokens: [],
                realtimeFeedTokens: [TOKEN_ADDRESSES['ETH'], TOKEN_ADDRESSES['USDC']],
                realtimeFeedData: [
                    encodeRealtimeData({
                        ...getBaseRealtimeDataForBlockRange(block0, block3, parseInt(tokensPrices.get("ETH")?.toString() || "0")),
                        feedId: hashString("ETH"),
                        bid: expandDecimals(parseInt(tokensPrices.get("ETH")?.toString() || "0"), 8),
                        ask: expandDecimals(parseInt(tokensPrices.get("ETH")?.toString() || "0"), 8),
                    }),
                    encodeRealtimeData({
                        ...getBaseRealtimeDataForBlockRange(block3, block4, parseInt(tokensPrices.get("USDC")?.toString() || "0")),
                        feedId: hashString("USDC"),
                        bid: expandDecimals(parseInt(tokensPrices.get("USDC")?.toString() || "0"), 8),
                        ask: expandDecimals(parseInt(tokensPrices.get("USDC")?.toString() || "0"), 8),
                    }),
                ],
            }
            await depositHandler.connect(orderKeeper).executeDeposit(depositKey[0], oracleParm);
        });

        it("should deposit multiple assets to GMX V2", async () => {
            const tokenAmount = toWei('0.05');
            const tokenBAmount = 10 * 1000000;
            const maxFee = toWei('0.01');
            const estimateOutput = (0.05 * tokensPrices.get("ETH")!  + 10 * tokensPrices.get("USDC")!) / tokensPrices.get("GM_ETH_WETH_USDC")!;

            await expect(wrappedLoan.depositEthUsdcGmxV2(tokenAmount, tokenBAmount, 0, maxFee, { value: maxFee })).to.be.revertedWith("Invalid min output value");
            
            await wrappedLoan.depositEthUsdcGmxV2(tokenAmount, tokenBAmount, toWei(estimateOutput.toString()), maxFee, { value: maxFee })

            let depositCount = await getDepositCount(dataStore);
            console.log("Total Depsit Count:", depositCount);

            const depositKey = await getDepositKeys(dataStore, 0, 1);
            console.log("Deposit Key", depositKey);

            const block = await provider.getBlock();
            const block0 = await provider.getBlock(block.number - 5);
            const block1 = await provider.getBlock(block.number - 4);
            const block2 = await provider.getBlock(block.number - 3);
            const block3 = await provider.getBlock(block.number - 2);
            const block4 = await provider.getBlock(block.number - 1);
            const block5 = block;
            
            const oracleParm = {
                signerInfo: 0,
                tokens: [],
                compactedMinOracleBlockNumbers: [],
                compactedMaxOracleBlockNumbers: [],
                compactedOracleTimestamps: [],
                compactedDecimals: [],
                compactedMinPrices: [],
                compactedMinPricesIndexes: [],
                compactedMaxPrices: [],
                compactedMaxPricesIndexes: [],
                signatures: [],
                priceFeedTokens: [],
                realtimeFeedTokens: [TOKEN_ADDRESSES['ETH'], TOKEN_ADDRESSES['USDC']],
                realtimeFeedData: [
                    encodeRealtimeData({
                        ...getBaseRealtimeDataForBlockRange(block0, block3, parseInt(tokensPrices.get("ETH")?.toString() || "0")),
                        feedId: hashString("ETH"),
                        bid: expandDecimals(parseInt(tokensPrices.get("ETH")?.toString() || "0"), 8),
                        ask: expandDecimals(parseInt(tokensPrices.get("ETH")?.toString() || "0"), 8),
                    }),
                    encodeRealtimeData({
                        ...getBaseRealtimeDataForBlockRange(block3, block4, parseInt(tokensPrices.get("USDC")?.toString() || "0")),
                        feedId: hashString("USDC"),
                        bid: expandDecimals(parseInt(tokensPrices.get("USDC")?.toString() || "0"), 8),
                        ask: expandDecimals(parseInt(tokensPrices.get("USDC")?.toString() || "0"), 8),
                    }),
                ],
            }
            await depositHandler.connect(orderKeeper).executeDeposit(depositKey[0], oracleParm);
        });

        it("should withdraw from GMX V2", async () => {
            const gmAmount = await tokenContracts.get('GM_ETH_WETH_USDC')!.balanceOf(wrappedLoan.address);
            const maxFee = toWei('0.01');

            await wrappedLoan.withdrawEthUsdcGmxV2(gmAmount, 0, 0, maxFee, { value: maxFee });
        });
    });
});


