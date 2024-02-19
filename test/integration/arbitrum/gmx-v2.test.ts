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
                    "0x000637558ae605b87120ff75c52308703f79ebafba207a65d69705ec7ba8beb7000000000000000000000000000000000000000000000000000000001d2cfd01000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000002c00100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012074aca63821bf7ead199e924d261d277cbec96d1026ab65267d655c51b45369140000000000000000000000000000000000000000000000000000000065d31f8200000000000000000000000000000000000000000000000000000043df26a2a000000000000000000000000000000000000000000000000000000043def2252000000000000000000000000000000000000000000000000000000043df5b2020000000000000000000000000000000000000000000000000000000000add853331cb1191180c5876af1d410f45b2836ec40bec8eb3b6554d1868ceaf8119ccf1000000000000000000000000000000000000000000000000000000000add85310000000000000000000000000000000000000000000000000000000065d31f820000000000000000000000000000000000000000000000000000000000000004b9a85614963b80f6eea03a8ba9c50bf5187081c008d5405f8678ea93d22097fa61a9d18d63be77ffac4b534ed03e562ae536249d0870f8d40c2b40222834ea878250a01985982579b57488f12519ebd44dad25a4ca485f1beab5c7856448e20d06b3839c6702f317d36f5afaea6837b8e357e1430333828f39e44b8c0aa8f1cf0000000000000000000000000000000000000000000000000000000000000004329e93eb5fc1aefe778389288c0f94cc5e4a6d065fa63fd39650a0908dc98e6022fdf264fc6edb4427fe54834c6aca9ddf920e7699d1333510632d26cdfd85ba2b279f069f05ac0366d4920649974d37ff41f2ce9109dd81745a09f039ae359328a0ad4c29d64fef1af5d331c40bbac278c278557a062ae820a599865dc695b9",
                    "0x000636e8260d36292bcbc2d205dc922cde2a93a929350b7163c803ac4fd89560000000000000000000000000000000000000000000000000000000001d09ce05000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000002c00001000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012095241f154d34539741b19ce4bae815473fd1b2a90ac3b4b023a692f31edfe90e0000000000000000000000000000000000000000000000000000000065d31f820000000000000000000000000000000000000000000000000000000005f5f4870000000000000000000000000000000000000000000000000000000005f5e0170000000000000000000000000000000000000000000000000000000005f6080f000000000000000000000000000000000000000000000000000000000add85319a0ed0abf8e84a9cdc1f2d925346efc24faff3ddc71505cca1a8842431dc2c99000000000000000000000000000000000000000000000000000000000add85310000000000000000000000000000000000000000000000000000000065d31f820000000000000000000000000000000000000000000000000000000000000004031b39b137470e972a6e79aaea572d5f8807a3674200cb821c105295fe837c2b31870c889ea1ccf2abf0b26aedad02c798b5c03c1bc46b780ebbd4aa0043b63db3ccd9dbe1b19ee5cc4e466be56dde0143b5b0a296eb0eb7e5891725cfa364126df10788b120ccb54cc43c0ac2e706f4a7d12208a864b889ea186beb0cffe3420000000000000000000000000000000000000000000000000000000000000004506145ba255e941bc76fbaead09a82936b1e9b58c3958bbf8ea5eb9408cfb7cf0f7f615a0b35de0fd73650c6f333f048f2babab90c29261de4b1acbc18e0c4461614cd07b0c8eb131abecb61ffa5d42f4f13664abe5a9436398f0ff6ba59f84a714b957eaf4e78572c35b8600a900623669a854399c85af48efe8be0039fa970"
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
                    "0x000637558ae605b87120ff75c52308703f79ebafba207a65d69705ec7ba8beb7000000000000000000000000000000000000000000000000000000001d2cfd01000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000002c00100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012074aca63821bf7ead199e924d261d277cbec96d1026ab65267d655c51b45369140000000000000000000000000000000000000000000000000000000065d31f8200000000000000000000000000000000000000000000000000000043df26a2a000000000000000000000000000000000000000000000000000000043def2252000000000000000000000000000000000000000000000000000000043df5b2020000000000000000000000000000000000000000000000000000000000add853331cb1191180c5876af1d410f45b2836ec40bec8eb3b6554d1868ceaf8119ccf1000000000000000000000000000000000000000000000000000000000add85310000000000000000000000000000000000000000000000000000000065d31f820000000000000000000000000000000000000000000000000000000000000004b9a85614963b80f6eea03a8ba9c50bf5187081c008d5405f8678ea93d22097fa61a9d18d63be77ffac4b534ed03e562ae536249d0870f8d40c2b40222834ea878250a01985982579b57488f12519ebd44dad25a4ca485f1beab5c7856448e20d06b3839c6702f317d36f5afaea6837b8e357e1430333828f39e44b8c0aa8f1cf0000000000000000000000000000000000000000000000000000000000000004329e93eb5fc1aefe778389288c0f94cc5e4a6d065fa63fd39650a0908dc98e6022fdf264fc6edb4427fe54834c6aca9ddf920e7699d1333510632d26cdfd85ba2b279f069f05ac0366d4920649974d37ff41f2ce9109dd81745a09f039ae359328a0ad4c29d64fef1af5d331c40bbac278c278557a062ae820a599865dc695b9",
                    "0x000636e8260d36292bcbc2d205dc922cde2a93a929350b7163c803ac4fd89560000000000000000000000000000000000000000000000000000000001d09ce05000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000002c00001000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012095241f154d34539741b19ce4bae815473fd1b2a90ac3b4b023a692f31edfe90e0000000000000000000000000000000000000000000000000000000065d31f820000000000000000000000000000000000000000000000000000000005f5f4870000000000000000000000000000000000000000000000000000000005f5e0170000000000000000000000000000000000000000000000000000000005f6080f000000000000000000000000000000000000000000000000000000000add85319a0ed0abf8e84a9cdc1f2d925346efc24faff3ddc71505cca1a8842431dc2c99000000000000000000000000000000000000000000000000000000000add85310000000000000000000000000000000000000000000000000000000065d31f820000000000000000000000000000000000000000000000000000000000000004031b39b137470e972a6e79aaea572d5f8807a3674200cb821c105295fe837c2b31870c889ea1ccf2abf0b26aedad02c798b5c03c1bc46b780ebbd4aa0043b63db3ccd9dbe1b19ee5cc4e466be56dde0143b5b0a296eb0eb7e5891725cfa364126df10788b120ccb54cc43c0ac2e706f4a7d12208a864b889ea186beb0cffe3420000000000000000000000000000000000000000000000000000000000000004506145ba255e941bc76fbaead09a82936b1e9b58c3958bbf8ea5eb9408cfb7cf0f7f615a0b35de0fd73650c6f333f048f2babab90c29261de4b1acbc18e0c4461614cd07b0c8eb131abecb61ffa5d42f4f13664abe5a9436398f0ff6ba59f84a714b957eaf4e78572c35b8600a900623669a854399c85af48efe8be0039fa970"
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


