import {ethers, waffle} from 'hardhat'
import chai, {expect, util} from 'chai'
import {solidity} from "ethereum-waffle";
import { constructSimpleSDK, SimpleFetchSDK, SwapSide, ContractMethod } from '@paraswap/sdk';
import axios from 'axios';

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
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
    getContractSelectors
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
import {BigNumber, Contract, constants} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import { parseUnits } from 'ethers/lib/utils';

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
            let assetsList = ['AVAX', 'BTC', 'USDT', 'USDC', 'GM_AVAX_WAVAX_USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 1000, 'AVAX');

            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, [{symbol: 'LVL', value: 1}]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList, 'AVAX');
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, [], 'AVAX');

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            getContractSelectors(tokenManager);

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
                "AVAX",
                "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
            );

            await deployAllFacets(diamondAddress, true, 'AVAX');
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
            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let swapData = await getSwapData('AVAX', 'USDC', 18, 6, toWei('2'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('2'), TOKEN_ADDRESSES['USDC'], parseUnits((tokensPrices.get("AVAX")! * 1.96).toFixed(6), 6));
            usdtBalance = await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address);
            swapData = await getSwapData('AVAX', 'USDC', 18, 6, toWei('2'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('2'), TOKEN_ADDRESSES['USDC'], parseUnits((tokensPrices.get("AVAX")! * 1.96).toFixed(6), 6));
            usdcBalance = await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(fromWei(initialHR));
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 20);
        });

        it("should deposit one side token to GMX V2", async () => {
            const tokenAmount = toWei('0.05');
            const maxFee = toWei('0.01');
            const estimateOutput = 0.05 * tokensPrices.get("AVAX")! / tokensPrices.get("GM_AVAX_WAVAX_USDC")!;
            
            await expect(wrappedLoan.depositAvaxUsdcGmxV2(tokenAmount, 0, 0, maxFee, { value: maxFee })).to.be.revertedWith("Invalid min output value");
            
            await wrappedLoan.depositAvaxUsdcGmxV2(tokenAmount, 0, toWei(estimateOutput.toString()), maxFee, { value: maxFee })
        });

        it("should deposit multiple assets to GMX V2", async () => {
            const tokenAmount = toWei('0.05');
            const tokenBAmount = 10 * 1000000;
            const maxFee = toWei('0.01');
            const estimateOutput = (0.05 * tokensPrices.get("AVAX")!  + 10 * tokensPrices.get("USDC")!) / tokensPrices.get("GM_AVAX_WAVAX_USDC")!;
            
            await expect(wrappedLoan.depositAvaxUsdcGmxV2(tokenAmount, tokenBAmount, 0, maxFee, { value: maxFee })).to.be.revertedWith("Invalid min output value");
            
            await wrappedLoan.depositAvaxUsdcGmxV2(tokenAmount, tokenBAmount, toWei(estimateOutput.toString()), maxFee, { value: maxFee })
        });

        it("should withdraw from GMX V2", async () => {
            const gmAmount = await tokenContracts.get('GM_AVAX_WAVAX_USDC')!.balanceOf(wrappedLoan.address);
            const maxFee = toWei('0.01');

            await wrappedLoan.depositAvaxUsdcGmxV2(gmAmount, 0, 0, maxFee, { value: maxFee });
        });
    });
});


