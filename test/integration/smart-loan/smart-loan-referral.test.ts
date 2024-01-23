import {ethers, waffle} from "hardhat";
import chai, {expect} from "chai";
import {solidity} from "ethereum-waffle";
import {parseUnits} from "ethers/lib/utils";

import SmartLoansFactoryArtifact from "../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json";
import MockTokenManagerArtifact from "../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json";
import PoolArtifact from '../../../artifacts/contracts/Pool.sol/Pool.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import PrimeDexArtifact from '../../../artifacts/contracts/PrimeDex.sol/PrimeDex.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
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
import {syncTime} from "../../_syncTime";
import {
    AddressProvider,
    PrimeDex,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    PangolinIntermediary,
    Pool,
} from "../../../typechain";
import {deployDiamond} from "../../../tools/diamond/deploy-diamond";
import {getProvider} from "../../../tools/liquidation/utlis";
import {Contract, BigNumber} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;
const pangolinRouterAddress = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";

const args = require("yargs").argv;
const network = args.network ? args.network : "localhost";
let provider = getProvider(network);

describe("Smart loan", () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe("Referral Program", () => {
        let smartLoansFactory: SmartLoansFactory,
            referrerLoan: SmartLoanGigaChadInterface,
            refereeLoan: SmartLoanGigaChadInterface,
            exchange: PangolinIntermediary,
            referralCode: string,
            invalidReferralCode: string,
            primeDex: PrimeDex,
            wrappedLoanReferrer: any,
            wrappedLoanReferee: any,
            tokenManager: MockTokenManager,
            dynamicNameMapping: NameMapping = {},
            owner: SignerWithAddress,
            referrer: SignerWithAddress,
            referee: SignerWithAddress,
            nonOwner: SignerWithAddress,
            depositor: SignerWithAddress,
            feeReceiver: SignerWithAddress,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            MOCK_PRICES: any;

        before(
            "deploy factory, wrapped native token pool and USD pool",
            async () => {
                [owner, referrer, referee, nonOwner, depositor, feeReceiver] = await getFixedGasSigners(10000000);

                let assetsList = ["AVAX", "USDC", "USDT", "ETH"];
                let poolNameAirdropList: Array<PoolInitializationObject> = [
                    {name: "AVAX", airdropList: [depositor]},
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

                tokenManager = (await deployContract(
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

        interface NameMapping {
            [name: string]: string;
        }

        interface BalanceCache {
            [address: string]: ethers.BigNumber;
        }

        let balanceCache: BalanceCache = {};

        async function logERC20Balances(
            tokenNames: string[],
            accountAddresses: string[],
            nameMapping: NameMapping = {},
            dynamicNameMapping: NameMapping = {}
        ) {
            console.log('======== BALANCES ========')
            for (const account of accountAddresses) {
                const accountName = dynamicNameMapping[account] || account;
                console.log(`\nAccount: ${accountName} (${account})`);
                for (const tokenName of tokenNames) {
                    const token = nameMapping[tokenName];
                    const tokenContract = await ethers.getContractAt("IERC20Metadata", token);
                    const decimals = await tokenContract.decimals();
                    const balance = await tokenContract.balanceOf(account);
                    const formattedBalance = ethers.utils.formatUnits(balance, decimals);
                    const cacheKey = `${account}-${token}`;
                    const oldBalance = balanceCache[cacheKey] || ethers.BigNumber.from(0);
                    const delta = balance.sub(oldBalance);
                    const formattedDelta = ethers.utils.formatUnits(delta, decimals);
                    balanceCache[cacheKey] = balance;
                    console.log(`Token: ${tokenName} (${token}), Balance: ${formattedBalance}, Delta: ${formattedDelta}`);
                }
            }
            console.log('==========================')
        }

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(referrer).createLoan(ethers.constants.HashZero);
            referralCode = toBytes32("referral code");
            invalidReferralCode = toBytes32("invalid referral code");
            await smartLoansFactory.connect(referrer).setReferralCode(referralCode);
            await smartLoansFactory.connect(referrer).setFeeAsset(toBytes32("USDT"));

            await smartLoansFactory.connect(referee).createLoan(referralCode);

            const referrer_loan_proxy_address = await smartLoansFactory.getLoanForOwner(
                referrer.address
            );
            const referee_loan_proxy_address = await smartLoansFactory.getLoanForOwner(
                referee.address
            );
            referrerLoan = await ethers.getContractAt(
                "SmartLoanGigaChadInterface",
                referrer_loan_proxy_address,
                referrer
            );
            refereeLoan = await ethers.getContractAt(
                "SmartLoanGigaChadInterface",
                referee_loan_proxy_address,
                referee
            );

            wrappedLoanReferrer = WrapperBuilder
                // @ts-ignore
                .wrap(referrerLoan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
            wrappedLoanReferee = WrapperBuilder
                // @ts-ignore
                .wrap(refereeLoan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            dynamicNameMapping[wrappedLoanReferrer.address] = 'ReferrerWrappedLoan';
            dynamicNameMapping[wrappedLoanReferee.address] = 'RefereeWrappedLoan';
            dynamicNameMapping[primeDex.address] = 'PrimeDex';
            dynamicNameMapping[feeReceiver.address] = 'FeeReceiver';

            const usdcPoolAddress = await tokenManager.getPoolAddress(toBytes32("USDC"));
            const usdcPool = (new ethers.Contract(usdcPoolAddress, PoolArtifact.abi, provider)) as Pool;

            await usdcPool.setReferrerFee(toWei("0.05")); // 5%
            await usdcPool.setReferrerProtocolFee(toWei("0.01")); // 1%
            await usdcPool.setNoReferrerProtocolFee(toWei("0.08")); // 8%
            await usdcPool.setProtocolFeeReceiver(feeReceiver.address);

            const usdtPoolAddress = await tokenManager.getPoolAddress(toBytes32("USDT"));
            const usdtPool = (new ethers.Contract(usdtPoolAddress, PoolArtifact.abi, provider)) as Pool;

            await usdtPool.setReferrerFee(toWei("0.05")); // 5%
            await usdtPool.setReferrerProtocolFee(toWei("0.01")); // 1%
            await usdtPool.setNoReferrerProtocolFee(toWei("0.08")); // 8%
            await usdtPool.setProtocolFeeReceiver(feeReceiver.address);
        });

        it("should fund, borrow and transfer target asset to converter contract", async () => {
            // Fund PrimeAccounts with 300 WAVAX
            await tokenContracts
                .get("AVAX")!
                .connect(referrer)
                .deposit({value: toWei("300")});
            await tokenContracts
                .get("AVAX")!
                .connect(referrer)
                .approve(wrappedLoanReferrer.address, toWei("300"));
            await wrappedLoanReferrer.fund(toBytes32("AVAX"), toWei("300"));

            await tokenContracts
                .get("AVAX")!
                .connect(referee)
                .deposit({value: toWei("300")});
            await tokenContracts
                .get("AVAX")!
                .connect(referee)
                .approve(wrappedLoanReferrer.address, toWei("300"));
            await wrappedLoanReferee.fund(toBytes32("AVAX"), toWei("300"));
            // =======


            const usdcAmount = parseUnits("600", BigNumber.from("6"));
            const amountSwapped = toWei("50");
            await tokenContracts
                .get("AVAX")!
                .connect(depositor)
                .deposit({value: amountSwapped});
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

            await wrappedLoanReferrer.swapPangolin(toBytes32("AVAX"), toBytes32("USDT"), toWei("10"), 0);

            await wrappedLoanReferrer.borrow(toBytes32("USDT"), parseUnits("10", BigNumber.from("6")));
            await wrappedLoanReferee.borrow(toBytes32("USDC"), parseUnits("500", BigNumber.from("6")));
        });

        it("should fail to create loan using invalid referral code", async () => {
            await expect(
                smartLoansFactory.connect(nonOwner).createLoan(invalidReferralCode)
            ).to.be.revertedWith("Invalid referral code");
        });
    });
});
