import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import PoolManagerArtifact from '../../../artifacts/contracts/PoolManager.sol/PoolManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {
    Asset,
    deployAllFaucets,
    deployAndInitExchangeContract,
    deployAndInitializeLendingPool,
    getFixedGasSigners,
    PoolAsset,
    recompileSmartLoanLib,
    toBytes32,
    toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {PoolManager, RedstoneConfigManager__factory, SmartLoansFactory, PangolinIntermediary,} from "../../../typechain";
import {BigNumber, Contract, ContractFactory} from "ethers";
import {liquidateLoan} from '../../../tools/liquidation/liquidation-bot'
import redstone from "redstone-api";
import {parseUnits} from "ethers/lib/utils";
import fs from "fs";
import path from "path";

const {deployDiamond, deployFacet, replaceFacet} = require('../../../tools/diamond/deploy-diamond');

chai.use(solidity);

const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function transfer(address dst, uint wad) public returns (bool)'
]

const wavaxAbi = [
    'function deposit() public payable',
    ...erc20ABI
]

const LIQUIDATOR_PRIVATE_KEY =  fs.readFileSync(path.resolve(__dirname, "../../../tools/liquidation/.private")).toString().trim();
const rpcProvider = new ethers.providers.JsonRpcProvider()
const liquidatorWallet = (new ethers.Wallet(LIQUIDATOR_PRIVATE_KEY)).connect(rpcProvider);

describe('Test liquidator',  () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    describe('A loan with debt and repayment', () => {
        let exchange: PangolinIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: Contract,
            wrappedLoan: any,
            redstoneConfigManager: any,
            poolManager: any,
            tokenContracts: any = {},
            poolContracts: any = {},
            MOCK_PRICES: any,
            AVAX_PRICE: number,
            USD_PRICE: number,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            borrower: SignerWithAddress,
            diamondAddress: any;


        before("deploy factory, exchange, WrappedNativeTokenPool and usdPool", async () => {
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);

            redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(
                [
                    "0xFE71e9691B9524BC932C23d0EeD5c9CE41161884",
                    "0x1cd8f9627a2838a7dae6b98cf71c08b9cbf5174a",
                    "0x981bda8276ae93f567922497153de7a5683708d3",
                    "0x3befdd935b50f172e696a5187dbacfef0d208e48",
                    "0xc1d5b940659e57b7bdf8870cdfc43f41ca699460",
                    "0xbc5a06815ee80de7d20071703c1f1b8fc511c7d4",
                    "0x496f4e8ac11076350a59b88d2ad62bc20d410ea3",
                    "0xe9fa2869c5f6fc3a0933981825564fd90573a86d",
                    "0xdf6b1ca313bee470d0142279791fa760abf5c537",
                ],
                    30)
            );

            let lendingPools = [];
            for (const token of [
                {'name': 'USDC', 'airdropList': [], 'autoPoolDeposit': false},
                {'name': 'AVAX', 'airdropList': [depositor, borrower], 'autoPoolDeposit': true},
            ]) {
                let {poolContract, tokenContract} = await deployAndInitializeLendingPool(owner, token.name, token.airdropList);
                if(token.autoPoolDeposit) {
                    await tokenContract!.connect(depositor).approve(poolContract.address, toWei("1000"));
                    await poolContract.connect(depositor).deposit(toWei("1000"));
                }
                lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
                poolContracts[token.name] = poolContract;
                tokenContracts[token.name] = tokenContract;
            }

            //load liquidator wallet
            await tokenContracts['AVAX'].connect(liquidatorWallet).deposit({value: toWei("1000")});


            const supportedAssets = [
                new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
                new Asset(toBytes32('USDC'), TOKEN_ADDRESSES['USDC'])
            ];

            AVAX_PRICE = (await redstone.getPrice('AVAX', { provider: "redstone-avalanche-prod-node-3"})).value;
            USD_PRICE = (await redstone.getPrice('USDC', { provider: "redstone-avalanche-prod-node-3"})).value;

            MOCK_PRICES = [
                {
                    symbol: 'AVAX',
                    value: AVAX_PRICE
                },
                {
                    symbol: 'USDC',
                    value: USD_PRICE
                },
            ];

            poolManager = await deployContract(
                owner,
                PoolManagerArtifact,
                [
                    supportedAssets,
                    lendingPools
                ]
            ) as PoolManager;

            diamondAddress = await deployDiamond();

            await recompileSmartLoanLib(
                "SmartLoanConfigLib",
                [],
                poolManager.address,
                redstoneConfigManager.address,
                diamondAddress,
                ethers.constants.AddressZero,
                'lib'
            );

            exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await recompileSmartLoanLib(
                "SmartLoanConfigLib",
                [
                    {
                        facetPath: './contracts/faucets/PangolinDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                poolManager.address,
                redstoneConfigManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );
            await deployAllFaucets(diamondAddress);
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            wrappedLoan = WrapperBuilder
                .mockLite(loan)
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    });
        });


        it("should fund, borrow and withdraw, making loan LTV higher than 500%", async () => {
            await tokenContracts['AVAX'].connect(borrower).deposit({value: toWei("100")});
            await tokenContracts['AVAX'].connect(borrower).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("600"));

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei("700"),
                parseUnits((0.97 * 700 * AVAX_PRICE).toFixed(6), BigNumber.from("6"))
            );

            expect((await wrappedLoan.getLTV()).toNumber()).to.be.gt(5000);
        });

        it("replace facet", async () => {
            await replaceFacet('SolvencyFacet', diamondAddress, ['isSolvent']);

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            await liquidateLoan(wrappedLoan.address, poolManager.address);

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });
});

