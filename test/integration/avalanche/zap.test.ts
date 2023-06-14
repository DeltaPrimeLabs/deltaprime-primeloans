import {ethers, waffle} from 'hardhat';
import chai from 'chai';
import {BigNumber, Contract} from 'ethers';
import {solidity} from "ethereum-waffle";
import { constructSimpleSDK, SimpleFetchSDK, SwapSide } from '@paraswap/sdk';
import axios from 'axios';

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {parseUnits} from "ethers/lib/utils";
import {
    TraderJoeIntermediary,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from '../../../typechain';
import {
    deployPools,
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    fromBytes32,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    syncTime,
    toBytes32,
    toWei,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    paraSwapRouteToSimpleData,
    deployAndInitExchangeContract,
} from "../../_helpers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract} = waffle;
const {expect} = chai;

const traderJoeRouterAddress = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";

describe('Zap', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('Test zap functions', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            exchange: TraderJoeIntermediary,
            nonOwnerWrappedLoan: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            wrappedLoan: any,
            owner: SignerWithAddress,
            nonOwner: SignerWithAddress,
            depositor: SignerWithAddress,
            paraSwapMin: SimpleFetchSDK,
            MOCK_PRICES: any,
            farmAmount: BigNumber,
            diamondAddress: any;

        const getSwapData = async (srcToken: keyof typeof TOKEN_ADDRESSES, destToken: keyof typeof TOKEN_ADDRESSES, srcAmount: any) => {
            const priceRoute = await paraSwapMin.swap.getRate({
                srcToken: TOKEN_ADDRESSES[srcToken],
                destToken: TOKEN_ADDRESSES[destToken],
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
            const swapData = paraSwapRouteToSimpleData(txParams);
            return swapData;
        };

        const encodeParaSwapData = (swapData: ReturnType<typeof paraSwapRouteToSimpleData>) => {
            return ethers.utils.defaultAbiCoder.encode(
                ["tuple(address fromToken, address toToken, uint256 fromAmount, uint256 toAmount, uint256 expectedAmount, address[] callees, bytes exchangeData, uint256[] startIndexes, uint256[] values, address beneficiary, address partner, uint256 feePercent, bytes permit, uint256 deadline, bytes16 uuid)"],
                [swapData]
            );
        };

        before('deploy factory and pool', async () => {
            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);

            let assetsList = ['AVAX', 'USDC', 'ETH', 'crvUSDBTCETH', 'DAIe', 'USDCe', "USDT.e", 'WBTCe'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                { name: 'AVAX', airdropList: [depositor] },
                { name: "USDC", airdropList: [] },
                { name: "ETH", airdropList: [] },
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 2000);

            tokensPrices = await getTokensPricesMap(
                ['AVAX', 'USDC', 'ETH'],
                getRedstonePrices,
                [
                    {symbol: 'DAIe', value: 1},
                    {symbol: 'USDCe', value: 1},
                    {symbol: "USDT.e", value: 1},
                    {symbol: 'WBTCe', value: 26500},
                    {symbol: 'crvUSDBTCETH', value: 1000},
                ]
            );
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

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            exchange = (await deployAndInitExchangeContract(
                owner,
                traderJoeRouterAddress,
                tokenManager.address,
                supportedAssets,
                "TraderJoeIntermediary"
            )) as TraderJoeIntermediary;

            await recompileConstantsFile(
                "local",
                "DeploymentConstants",
                [
                    {
                        facetPath: "./contracts/facets/avalanche/TraderJoeDEXFacet.sol",
                        contractAddress: exchange.address,
                    },
                ],
                tokenManager.address,
                diamondAddress,
                smartLoansFactory.address,
                "lib"
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
                .wrap(loan.connect(nonOwner))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should fund a loan and deposit USDC", async () => {
            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));

            const usdcDeposited = parseUnits("500", BigNumber.from("6"));
            const amountSwapped = toWei("50");
            await tokenContracts
                .get("AVAX")!
                .connect(owner)
                .deposit({ value: amountSwapped });
            await tokenContracts
                .get("AVAX")!
                .connect(owner)
                .approve(exchange.address, amountSwapped);
            await tokenContracts
                .get("AVAX")!
                .connect(owner)
                .transfer(exchange.address, amountSwapped);
            await exchange
                .connect(owner)
                .swap(
                    TOKEN_ADDRESSES["AVAX"],
                    TOKEN_ADDRESSES["USDC"],
                    amountSwapped,
                    usdcDeposited
                );
            await tokenContracts
                .get("USDC")!
                .connect(owner)
                .approve(poolContracts.get("USDC")!.address, usdcDeposited);
            await poolContracts.get("USDC")!.connect(owner).deposit(usdcDeposited);
        });

        it("should fail to long as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.long(parseUnits("500", 6), toBytes32("ETH"), toBytes32("crvUSDBTCETH"), 0, "0x")).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it('should long and farm to curve', async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let amount = parseUnits("100", 6);
            const swapData = await getSwapData('USDC', 'ETH', amount);
            const tx = await wrappedLoan.long(amount, toBytes32("ETH"), toBytes32("crvUSDBTCETH"), 1, encodeParaSwapData(swapData));
            const receipt = await tx.wait();
            const topic = ethers.utils.solidityKeccak256(["string"], ["Long(address,bytes32,bytes32,uint256,uint256,uint256)"])
            const log = receipt.logs.find((_log: any) => _log.topics[0] == topic);
            [, farmAmount, ] = ethers.utils.defaultAbiCoder.decode(["uint256", "uint256", "uint256"], log.data);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 100);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 100);
        });

        it("should fail to close long position as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.closeLongPosition(0, 0, "0x")).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it('should close long position', async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let amount = farmAmount;
            const swapData = await getSwapData('ETH', 'USDC', amount);
            await wrappedLoan.closeLongPosition(0, 1, encodeParaSwapData(swapData));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 100);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 100);
        });
    });
});
