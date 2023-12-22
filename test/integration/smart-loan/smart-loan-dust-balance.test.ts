import { ethers, waffle } from "hardhat";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { parseUnits } from "ethers/lib/utils";

import SmartLoansFactoryArtifact from "../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json";
import MockTokenManagerArtifact from "../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json";
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import PrimeDexArtifact from '../../../artifacts/contracts/PrimeDex.sol/PrimeDex.json';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { WrapperBuilder } from "@redstone-finance/evm-connector";
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAndInitExchangeContract,
    deployAllFacets,
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
import { syncTime } from "../../_syncTime";
import {
    AddressProvider,
    PrimeDex,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    PangolinIntermediary,
} from "../../../typechain";
import { deployDiamond } from "../../../tools/diamond/deploy-diamond";
import { getProvider } from "../../../tools/liquidation/utlis";
import { Contract, BigNumber } from "ethers";

chai.use(solidity);

const { deployContract } = waffle;
const pangolinRouterAddress = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";

const args = require("yargs").argv;
const network = args.network ? args.network : "localhost";
let provider = getProvider(network);

describe("Smart loan", () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe("Convert Dust Balance", () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            exchange: PangolinIntermediary,
            primeDex: PrimeDex,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            owner: SignerWithAddress,
            nonOwner: SignerWithAddress,
            depositor: SignerWithAddress,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            MOCK_PRICES: any;

        before(
            "deploy factory, wrapped native token pool and USD pool",
            async () => {
                [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);

                let assetsList = ["AVAX", "USDC", "USDT", "ETH"];
                let poolNameAirdropList: Array<PoolInitializationObject> = [
                    { name: "AVAX", airdropList: [depositor] },
                ];

                smartLoansFactory = (await deployContract(
                    owner,
                    SmartLoansFactoryArtifact
                )) as SmartLoansFactory;

                await deployPools(
                    smartLoansFactory,
                    poolNameAirdropList,
                    tokenContracts,
                    poolContracts,
                    lendingPools,
                    owner,
                    depositor,
                    2000
                );
                tokensPrices = await getTokensPricesMap(
                    assetsList,
                    "avalanche",
                    getRedstonePrices,
                    []
                );
                MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
                supportedAssets = convertAssetsListToSupportedAssets(assetsList);
                addMissingTokenContracts(tokenContracts, assetsList);

                let diamondAddress = await deployDiamond();

                let tokenManager = (await deployContract(
                    owner,
                    MockTokenManagerArtifact,
                    []
                )) as MockTokenManager;

                await tokenManager
                    .connect(owner)
                    .initialize(supportedAssets, lendingPools);
                await tokenManager
                    .connect(owner)
                    .setFactoryAddress(smartLoansFactory.address);

                await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

                let addressProvider = await deployContract(
                    owner,
                    AddressProviderArtifact,
                    []
                ) as AddressProvider;
                await addressProvider.connect(owner).initialize();

                primeDex = await deployContract(
                    owner,
                    PrimeDexArtifact,
                    [smartLoansFactory.address]
                ) as PrimeDex;

                await recompileConstantsFile(
                    'local',
                    "DeploymentConstants",
                    [],
                    tokenManager.address,
                    addressProvider.address,
                    primeDex.address,
                    diamondAddress,
                    smartLoansFactory.address,
                    'lib'
                );

                exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary");

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
                    primeDex.address,
                    diamondAddress,
                    smartLoansFactory.address,
                    'lib'
                );
    
                await deployAllFacets(diamondAddress);
            }
        );

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(
                owner.address
            );
            loan = await ethers.getContractAt(
                "SmartLoanGigaChadInterface",
                loan_proxy_address,
                owner
            );

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

        it("should fund and transfer target asset to converter contract", async () => {
            await tokenContracts
                .get("AVAX")!
                .connect(owner)
                .deposit({ value: toWei("300") });
            await tokenContracts
                .get("AVAX")!
                .connect(owner)
                .approve(wrappedLoan.address, toWei("300"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("300"));

            const usdcAmount = parseUnits("600", BigNumber.from("6"));
            const amountSwapped = toWei("50");
            await tokenContracts
                .get("AVAX")!
                .connect(depositor)
                .deposit({ value: amountSwapped });
            await tokenContracts
                .get("AVAX")!
                .connect(depositor)
                .approve(exchange.address, amountSwapped);
            await tokenContracts
                .get("AVAX")!
                .connect(depositor)
                .transfer(exchange.address, amountSwapped);

            await exchange
                .connect(depositor)
                .swap(
                    TOKEN_ADDRESSES["AVAX"],
                    TOKEN_ADDRESSES["USDC"],
                    amountSwapped,
                    usdcAmount
                );
            await tokenContracts
                .get("USDC")!
                .connect(depositor)
                .transfer(primeDex.address, usdcAmount);

            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("ETH"), toWei("0.8"), 0);
            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDT"), toWei("0.6"), 0);
            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDC"), toWei("0.4"), 0);
        });

        it("should fail to convert dust as a non-owner", async () => {
            await expect(
                nonOwnerWrappedLoan.convertDustAssets()
            ).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should convert dust balances", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            await wrappedLoan.convertDustAssets();

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 0.01);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(fromWei(initialHR));
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 0.01);
        });
    });
});
