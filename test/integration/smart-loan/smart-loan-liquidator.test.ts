import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import ERC20PoolArtifact from '../../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
    Asset,
    deployAndInitPangolinExchangeContract,
    getFixedGasSigners,
    recompileSmartLoanLib,
    toBytes32,
    toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
    CompoundingIndex,
    ERC20Pool,
    LTVLib,
    OpenBorrowersRegistry__factory,
    PangolinExchange,
    SmartLoanLiquidationFacet,
    SmartLoanLogicFacet,
    SmartLoansFactory,
    VariableUtilisationRatesCalculator,
    YieldYakRouter__factory
} from "../../../typechain";
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
const usdTokenAddress = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';
const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

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
        let exchange: PangolinExchange,
            smartLoansFactory: SmartLoansFactory,
            loanAddress: string,
            loanFactory: ContractFactory,
            loan: Contract,
            wrappedLoan: any,
            wavaxTokenContract: Contract,
            usdTokenContract: Contract,
            yakRouterContract: Contract,
            ltvLib: LTVLib,
            wavaxPool: ERC20Pool,
            usdPool: ERC20Pool,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            borrower: SignerWithAddress,
            diamondAddress: any;


        before("deploy factory, exchange, wavaxPool and usdPool", async () => {
            diamondAddress = await deployDiamond();
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);

            const supportedAssets = [
                new Asset(toBytes32('AVAX'), wavaxTokenAddress),
                new Asset(toBytes32('USDC'), usdTokenAddress)
            ];

            exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, supportedAssets);

            const variableUtilisationRatesCalculatorERC20 = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
            usdPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
            wavaxPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;

            yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

            wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider);
            usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);

            const borrowersRegistryERC20 = await (new OpenBorrowersRegistry__factory(owner).deploy());
            const depositIndexERC20 = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;
            const borrowingIndexERC20 = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;

            await wavaxPool.initialize(
                variableUtilisationRatesCalculatorERC20.address,
                borrowersRegistryERC20.address,
                depositIndexERC20.address,
                borrowingIndexERC20.address,
                wavaxTokenContract.address
            );

            await recompileSmartLoanLib(
                "SmartLoanLib",
                [0],
                [wavaxTokenAddress],
                {'AVAX': wavaxPool.address},
                exchange.address,
                yakRouterContract.address,
                'lib'
            );

            // Deploy LTVLib and later link contracts to it
            const LTVLib = await ethers.getContractFactory('LTVLib');
            ltvLib = await LTVLib.deploy() as LTVLib;


            await wavaxTokenContract.connect(depositor).deposit({value: toWei("1000")});
            await wavaxTokenContract.connect(depositor).approve(wavaxPool.address, toWei("1000"));
            await wavaxPool.connect(depositor).deposit(toWei("1000"));


            //load liquidator wallet
            await wavaxTokenContract.connect(liquidatorWallet).deposit({value: toWei("1000")});

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployFacet("MockSmartLoanLogicFacetAlwaysSolvent", diamondAddress, [], ltvLib.address);
            await deployFacet("SmartLoanLiquidationFacet", diamondAddress, ["liquidateLoan", "unsafeLiquidateLoan", "closeLoan"], ltvLib.address);
            await smartLoansFactory.initialize(diamondAddress);
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            loanFactory = await ethers.getContractFactory("MockSmartLoanLogicFacetAlwaysSolvent", {
                libraries: {
                    LTVLib: ltvLib.address
                }
            });

            loanAddress = await smartLoansFactory.getLoanForOwner(borrower.address);
            loan = await loanFactory.attach(loanAddress).connect(borrower) as SmartLoanLogicFacet;

            wrappedLoan = WrapperBuilder
                .wrapLite(loan)
                .usingPriceFeed("redstone-avalanche-prod")
        });


        it("should fund, borrow and withdraw, making loan LTV higher than 500%", async () => {
            await wavaxTokenContract.connect(borrower).deposit({value: toWei("100")});
            await wavaxTokenContract.connect(borrower).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

            const AVAX_PRICE = (await redstone.getPrice('AVAX')).value;

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("600"));

            await wrappedLoan.swap(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei("700"),
                parseUnits((0.97 * 700 * AVAX_PRICE).toFixed(6), BigNumber.from("6"))
            );

            expect((await wrappedLoan.getLTV()).toNumber()).to.be.gt(5000);
        });

        it("replace facet", async () => {
            const loanFactoryLiquidation = await ethers.getContractFactory("SmartLoanLiquidationFacet", {
                libraries: {
                    LTVLib: ltvLib.address
                }
            });

            await replaceFacet("SmartLoanLogicFacet", diamondAddress, [], ltvLib.address);

            loan = await loanFactoryLiquidation.attach(loanAddress).connect(owner) as SmartLoanLiquidationFacet;

            wrappedLoan = WrapperBuilder
                .wrapLite(loan)
                .usingPriceFeed("redstone-avalanche-prod")

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            await liquidateLoan(wrappedLoan.address);

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });
});

