import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';
import {BigNumber, Contract} from "ethers";
import config from '../../src/config';
import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import MockBorrowAccessNFTArtifact from '../../artifacts/contracts/mock/MockBorrowAccessNFT.sol/MockBorrowAccessNFT.json';
import MockDepositAccessNFTArtifact from '../../artifacts/contracts/mock/MockDepositAccessNFT.sol/MockDepositAccessNFT.json';
import PoolWithAccessNFTArtifact
    from '../../artifacts/contracts/upgraded/PoolWithAccessNFT.sol/PoolWithAccessNFT.json';
import PoolTUPArtifact from '../../artifacts/contracts/proxies/PoolTUP.sol/PoolTUP.json';
import ERC20PoolArtifact from '../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import SmartLoansFactoryArtifact from '../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import SmartLoansFactoryTUPArtifact
    from '../../artifacts/contracts/proxies/SmartLoansFactoryTUP.sol/SmartLoansFactoryTUP.json';
import CompoundingIndexArtifact from '../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    Asset,
    deployAndInitPangolinExchangeContract,
    fromWei,
    getFixedGasSigners,
    recompileSmartLoanLib, syncTime,
    toBytes32,
    toWei
} from "../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {
    MockBorrowAccessNFT,
    CompoundingIndex,
    MockDepositAccessNFT,
    PangolinExchange,
    ERC20Pool__factory,
    PoolTUP,
    PoolWithAccessNFT,
    PoolWithAccessNFT__factory,
    SmartLoansFactory,
    SmartLoansFactory__factory,
    SmartLoansFactoryTUP,
    ERC20Pool,
    YieldYakRouter__factory,
    MockSmartLoanLogicFacetRedstoneProvider,
    MockSmartLoanLogicFacetRedstoneProvider__factory,
    MockSmartLoanLogicFacetLimitedCollateral__factory,
    LTVLib,
    MockSmartLoanLogicFacetLimitedCollateral,
    MockSmartLoanLiquidationFacetRedstoneProvider
} from "../../typechain";
import {WrapperBuilder} from "redstone-evm-connector";

chai.use(solidity);

const {deployDiamond, deployFacet, replaceFacet} = require('./smart-loan/utils/deploy-diamond');
const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const usdTokenAddress = '0xc7198437980c041c805a1edcba50c1ce5db95118';
const WAVAXTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const MAX_COLLATERAL = config.MAX_COLLATERAL;

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function transfer(address _to, uint256 _value) public returns (bool success)',
]

const wavaxAbi = [
    'function deposit() public payable',
    ...erc20ABI
]

describe('Trading competition upgraded contracts test', () => {
    let loan: MockSmartLoanLogicFacetRedstoneProvider,
        smartLoansFactoryImplementation: Contract,
        smartLoansFactory: SmartLoansFactory,
        smartLoansFactoryTUP: SmartLoansFactoryTUP,
        usdTokenContract: Contract,
        wavaxTokenContract: Contract,
        usdTokenDecimalPlaces: BigNumber,
        wavaxPool: ERC20Pool,
        poolImpl: ERC20Pool,
        poolTUP: PoolTUP,
        yakRouterContract: Contract,
        poolUpgraded: PoolWithAccessNFT,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        depositorWithoutNFT: SignerWithAddress,
        user: SignerWithAddress,
        admin: SignerWithAddress,
        borrowNFT: Contract,
        depositNFT: Contract,
        exchange: PangolinExchange,
        mockVariableUtilisationRatesCalculator,
        maxCollateral: BigNumber,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number,
        ltvlib: LTVLib,
        diamondAddress: any;

    before(async () => {
        await syncTime();
        diamondAddress = await deployDiamond();
        [owner, admin, depositor, depositorWithoutNFT, user] = await getFixedGasSigners(10000000);

        AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
        USD_PRICE = (await redstone.getPrice('USDT')).value;

        MOCK_PRICES = [
            {
                symbol: 'USD',
                value: USD_PRICE
            },
            {
                symbol: 'AVAX',
                value: AVAX_PRICE
            }
        ]

        // token contracts
        wavaxTokenContract = new ethers.Contract(WAVAXTokenAddress, wavaxAbi, provider);
        usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
        usdTokenDecimalPlaces = await usdTokenContract.decimals();

        // Access NFTs
        borrowNFT = (await deployContract(owner, MockBorrowAccessNFTArtifact)) as MockBorrowAccessNFT;
        depositNFT = (await deployContract(owner, MockDepositAccessNFTArtifact)) as MockDepositAccessNFT;

        // Variable Rate Calculator
        mockVariableUtilisationRatesCalculator = await deployMockContract(owner, VariableUtilisationRatesCalculatorArtifact.abi);
        await mockVariableUtilisationRatesCalculator.mock.calculateDepositRate.returns(toWei("0.05"));
        await mockVariableUtilisationRatesCalculator.mock.calculateBorrowingRate.returns(toWei("0.05"));

        // Not upgraded Pool with TUP
        poolImpl = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
        poolTUP = (await deployContract(owner, PoolTUPArtifact, [poolImpl.address, admin.address, []])) as PoolTUP;
        wavaxPool = await new ERC20Pool__factory(owner).attach(poolTUP.address);
        yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

        // Borrow/Deposit indices
        const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;
        const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;

        // Assets exchange (without TUP)
        exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
            new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
            new Asset(toBytes32('USD'), usdTokenAddress)
        ]);

        // Smart Loan Implementation
        await recompileSmartLoanLib(
            'SmartLoanLib',
            [0],
            [wavaxTokenContract.address],
            {"AVAX": wavaxPool.address},
            exchange.address,
            yakRouterContract.address,
            'lib'
        );

        // Deploy LTVLib and later link contracts to it
        const LTVLib = await ethers.getContractFactory('LTVLib');
        ltvlib = await LTVLib.deploy() as LTVLib;

        await deployFacet("MockSmartLoanLogicFacetRedstoneProvider", diamondAddress, [], ltvlib.address);

        // Not upgraded smartLoansFactory with TUP
        smartLoansFactoryImplementation = (await deployContract(owner, SmartLoansFactoryArtifact)) as SmartLoansFactory;
        smartLoansFactoryTUP = (await deployContract(owner, SmartLoansFactoryTUPArtifact, [smartLoansFactoryImplementation.address, admin.address, []])) as SmartLoansFactoryTUP;
        smartLoansFactory = await new SmartLoansFactory__factory(owner).attach(smartLoansFactoryTUP.address);

        await smartLoansFactory.connect(owner).initialize(diamondAddress);

        await wavaxPool.initialize(
            mockVariableUtilisationRatesCalculator.address,
            smartLoansFactory.address,
            depositIndex.address,
            borrowingIndex.address,
            wavaxTokenContract.address
        );

        maxCollateral = toWei((0.99 * MAX_COLLATERAL / AVAX_PRICE).toString());
    });

    it("should deposit requested value without the access ERC721", async () => {
        await wavaxTokenContract.connect(depositor).deposit({value: toWei("1")});
        await wavaxTokenContract.connect(depositor).approve(wavaxPool.address, toWei("1"));
        await wavaxPool.connect(depositor).deposit(toWei("1"));

        const currentDeposits = await wavaxPool.balanceOf(depositor.address);
        expect(fromWei(currentDeposits)).to.equal(1);

        await wavaxPool.connect(depositor).withdraw(toWei("1.0"));
    });

    it("should deposit requested value only with the access ERC721", async () => {
        // Upgrade the wavaxPool
        const poolUpgradedImpl = await (deployContract(owner, PoolWithAccessNFTArtifact)) as PoolWithAccessNFT;
        await poolTUP.connect(admin).upgradeTo(poolUpgradedImpl.address);
        poolUpgraded = await new PoolWithAccessNFT__factory(owner).attach(wavaxPool.address);

        // Set NFT access
        await poolUpgraded.connect(owner).setAccessNFT(depositNFT.address);

        await expect(poolUpgraded.connect(depositor).deposit(toWei("10.0"))).to.be.revertedWith("Access NFT required");

        await depositNFT.connect(owner).addAvailableUri(["uri_1", "uri_2"]);
        await depositNFT.connect(depositor).safeMint("580528284777971734", "0x536aac0a69dea94674eb85fbad6dadf0460ac6de584a3429f1c39e99de67a72d7e7c2f246ab9c022d9341c26d187744ad8ccdfc5986cfc74e1fa2a5e1a4555381b");

        await wavaxTokenContract.connect(depositor).deposit({value: toWei("10.0")});
        await wavaxTokenContract.connect(depositor).approve(wavaxPool.address, toWei("10.0"));
        await poolUpgraded.connect(depositor).deposit(toWei("10.0"));

        expect(fromWei(await wavaxTokenContract.balanceOf(wavaxPool.address))).to.be.closeTo(10, 0.0001);
        expect(fromWei(await wavaxPool.balanceOf(depositor.address))).to.be.closeTo(10, 0.0001);
    });

    it(`should add and withdraw more than ${MAX_COLLATERAL} USD collateral in total with the base loan contract version`, async () => {
        await smartLoansFactory.connect(user).createLoan();
        const loan_proxy_address = await smartLoansFactory.getLoanForOwner(user.address);

        const loanFactory = await ethers.getContractFactory("MockSmartLoanLogicFacetRedstoneProvider", {
            libraries: {
                LTVLib: ltvlib.address
            }
        });
        loan = await loanFactory.attach(loan_proxy_address).connect(user) as MockSmartLoanLogicFacetRedstoneProvider;

        loan = WrapperBuilder
            .mockLite(loan.connect(user))
            .using(
                () => {
                    return {
                        prices: MOCK_PRICES,
                        timestamp: Date.now()
                    }
                });

        let moreThanMax = maxCollateral.add(toWei("10"));

        await wavaxTokenContract.connect(user).deposit({value: moreThanMax});
        await wavaxTokenContract.connect(user).approve(loan.address, moreThanMax);
        await loan.fund(toBytes32("AVAX"), moreThanMax);
        await loan.withdraw(toBytes32("AVAX"), moreThanMax);
    });

    it("should upgrade to new SmartLoanDiamond for competition purposes and test collateral limitations", async () => {
        await replaceFacet("MockSmartLoanLogicFacetLimitedCollateral", diamondAddress, [], ltvlib.address);

        const loan_proxy_address = await smartLoansFactory.getLoanForOwner(user.address);

        const loanFactory = await ethers.getContractFactory("MockSmartLoanLogicFacetLimitedCollateral", {
            libraries: {
                LTVLib: ltvlib.address
            }
        });
        loan = await loanFactory.attach(loan_proxy_address).connect(user) as MockSmartLoanLogicFacetLimitedCollateral;

        loan = WrapperBuilder
            .mockLite(loan)
            .using(
                () => {
                    return {
                        prices: MOCK_PRICES,
                        timestamp: Date.now()
                    }
                })

        let moreThanMax = maxCollateral.add(toWei("1"));

        await wavaxTokenContract.connect(user).deposit({value: moreThanMax});
        await wavaxTokenContract.connect(user).approve(loan.address, moreThanMax);
        await expect(loan.fund(toBytes32("AVAX"), moreThanMax)).to.be.revertedWith(`Adding more collateral than ${MAX_COLLATERAL} USD in total is not allowed`);

        await loan.fund(toBytes32("AVAX"), maxCollateral);

        await wavaxTokenContract.connect(user).deposit({value: toWei("2")});
        await wavaxTokenContract.connect(user).approve(loan.address, toWei("2"));
        await expect(loan.fund(toBytes32("AVAX"), toWei("2"))).to.be.revertedWith(`Adding more collateral than ${MAX_COLLATERAL} USD in total is not allowed`);

        await loan.withdraw(toBytes32("AVAX"), toWei("2"));

        await loan.fund(toBytes32("AVAX"), toWei("2"));
    });

    it("should test resetting collateral after closeLoan()", async () => {
        await deployFacet("MockSmartLoanLiquidationFacetRedstoneProvider", diamondAddress, ['closeLoan'], ltvlib.address)

        const loan_proxy_address = await smartLoansFactory.getLoanForOwner(user.address);

        const loanFactory = await ethers.getContractFactory("MockSmartLoanLiquidationFacetRedstoneProvider", {
            libraries: {
                LTVLib: ltvlib.address
            }
        });
        let loanLiquidation = await loanFactory.attach(loan_proxy_address).connect(user) as MockSmartLoanLiquidationFacetRedstoneProvider;

        loanLiquidation = WrapperBuilder
            .mockLite(loanLiquidation)
            .using(
                () => {
                    return {
                        prices: MOCK_PRICES,
                        timestamp: Date.now()
                    }
                })

        expect(fromWei(await loan.getTotalValue())).to.be.greaterThan(0);
        await loanLiquidation.closeLoan([0]);
        expect(fromWei(await loan.getTotalValue())).to.be.equal(0);
        await wavaxTokenContract.connect(user).approve(loan.address, maxCollateral);
        await loan.fund(toBytes32("AVAX"), maxCollateral);
    });

    it("should downgrade to old pool implementation and not require NFT access for deposit", async() => {
        await expect(wavaxPool.connect(depositorWithoutNFT).deposit(toWei("10.0"))).to.be.revertedWith("Access NFT required");

        await poolTUP.connect(admin).upgradeTo(poolImpl.address);

        await wavaxTokenContract.connect(depositorWithoutNFT).deposit({value: toWei("10")});
        await wavaxTokenContract.connect(depositorWithoutNFT).approve(wavaxPool.address, toWei("10"));
        await wavaxPool.connect(depositorWithoutNFT).deposit(toWei("10.0"));
        expect(await wavaxTokenContract.balanceOf(wavaxPool.address)).to.equal(toWei("20"));
    });
});