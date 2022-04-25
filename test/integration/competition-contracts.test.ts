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
    recompileSmartLoan, syncTime,
    toBytes32,
    toWei
} from "../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {
    MockBorrowAccessNFT,
    CompoundingIndex,
    MockDepositAccessNFT,
    MockSmartLoanRedstoneProvider,
    MockSmartLoanRedstoneProviderLimitedCollateral,
    MockSmartLoanRedstoneProvider__factory,
    PangolinExchange,
    ERC20Pool__factory,
    PoolTUP,
    PoolWithAccessNFT,
    PoolWithAccessNFT__factory,
    SmartLoan,
    SmartLoansFactory,
    SmartLoansFactory__factory,
    SmartLoansFactoryTUP,
    UpgradeableBeacon__factory,
    ERC20Pool,
    YieldYakRouter__factory
} from "../../typechain";
import {WrapperBuilder} from "redstone-evm-connector";
import {parseUnits} from "ethers/lib/utils";

chai.use(solidity);

const SMART_LOAN_MOCK = "MockSmartLoanRedstoneProvider";
const SMART_LOAN_MOCK_UPGRADED = "MockSmartLoanRedstoneProviderLimitedCollateral";
const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const usdTokenAddress = '0xc7198437980c041c805a1edcba50c1ce5db95118';
const WAVAXTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const MAX_COLLATERAL = config.MAX_COLLATERAL;

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)'
]

const wavaxAbi = [
    'function deposit() public payable',
    ...erc20ABI
]

describe('Trading competition upgraded contracts test', () => {
    let implementation: SmartLoan,
        loan: SmartLoan,
        smartLoansFactoryImplementation: Contract,
        smartLoansFactory: SmartLoansFactory,
        smartLoansFactoryTUP: SmartLoansFactoryTUP,
        usdTokenContract: Contract,
        wavaxTokenContract: Contract,
        usdTokenDecimalPlaces: BigNumber,
        usdPool: ERC20Pool,
        poolImpl: ERC20Pool,
        poolTUP: PoolTUP,
        yakRouterContract: Contract,
        poolUpgraded: PoolWithAccessNFT,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        user: SignerWithAddress,
        admin: SignerWithAddress,
        borrowNFT: Contract,
        depositNFT: Contract,
        exchange: PangolinExchange,
        mockVariableUtilisationRatesCalculator,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number;

    before(async () => {
        await syncTime();
        [owner, admin, depositor, user] = await getFixedGasSigners(10000000);

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
        usdPool = await new ERC20Pool__factory(owner).attach(poolTUP.address);
        yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

        // Borrow/Deposit indices
        const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [usdPool.address])) as CompoundingIndex;
        const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [usdPool.address])) as CompoundingIndex;

        // Assets exchange (without TUP)
        exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
            new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
            new Asset(toBytes32('USD'), usdTokenAddress)
        ]);

        // Smart Loan Implementation
        const artifact = await recompileSmartLoan(SMART_LOAN_MOCK, [1], {"USD": usdPool.address},  exchange.address, yakRouterContract.address,'mock');
        implementation = await deployContract(owner, artifact) as SmartLoan;

        // Not upgraded smartLoansFactory with TUP
        smartLoansFactoryImplementation = (await deployContract(owner, SmartLoansFactoryArtifact)) as SmartLoansFactory;
        smartLoansFactoryTUP = (await deployContract(owner, SmartLoansFactoryTUPArtifact, [smartLoansFactoryImplementation.address, admin.address, []])) as SmartLoansFactoryTUP;
        smartLoansFactory = await new SmartLoansFactory__factory(owner).attach(smartLoansFactoryTUP.address);

        await smartLoansFactory.connect(owner).initialize(implementation.address);

        await usdPool.initialize(
            mockVariableUtilisationRatesCalculator.address,
            smartLoansFactory.address,
            depositIndex.address,
            borrowingIndex.address,
            usdTokenContract.address
        );
    });

    it("should deposit requested value without the access ERC721", async () => {
        await usdTokenContract.connect(depositor).deposit({value: parseUnits("1")});
        await usdTokenContract.connect(depositor).approve(usdPool.address, toWei("1"));
        await usdPool.connect(depositor).deposit(toWei("1"));

        const currentDeposits = await usdPool.balanceOf(depositor.address);
        expect(fromWei(currentDeposits)).to.equal(1);

        await usdPool.connect(depositor).withdraw(toWei("1.0"));
    });

    it("should deposit requested value only with the access ERC721", async () => {
        // Upgrade the usdPool
        const poolUpgradedImpl = await (deployContract(owner, PoolWithAccessNFTArtifact)) as PoolWithAccessNFT;
        await poolTUP.connect(admin).upgradeTo(poolUpgradedImpl.address);
        poolUpgraded = await new PoolWithAccessNFT__factory(owner).attach(usdPool.address);

        // Set NFT access
        await poolUpgraded.connect(owner).setAccessNFT(borrowNFT.address);

        await expect(poolUpgraded.connect(depositor).deposit(toWei("10.0"))).to.be.revertedWith("Access NFT required");

        await borrowNFT.connect(owner).addAvailableUri(["uri_1", "uri_2"]);
        await borrowNFT.connect(depositor).safeMint("580528284777971734", "0x536aac0a69dea94674eb85fbad6dadf0460ac6de584a3429f1c39e99de67a72d7e7c2f246ab9c022d9341c26d187744ad8ccdfc5986cfc74e1fa2a5e1a4555381b");

        await usdTokenContract.connect(depositor).deposit({value: toWei("10.0")});
        await usdTokenContract.connect(depositor).approve(usdPool.address, toWei("10.0"));
        await poolUpgraded.connect(depositor).deposit(toWei("10.0"));

        expect(fromWei(await usdTokenContract.balanceOf(usdPool.address))).to.be.closeTo(10, 0.0001);
        expect(fromWei(await usdPool.balanceOf(depositor.address))).to.be.closeTo(10, 0.0001);
    });

    it("should add and withdraw more than 100 USD collateral in total with the base loan contract version", async () => {
        await smartLoansFactory.connect(user).createLoan();
        const SLAddress = await smartLoansFactory.getLoanForOwner(user.address);
        loan = await (new MockSmartLoanRedstoneProvider__factory(user).attach(SLAddress));
        loan = WrapperBuilder
            .mockLite(loan.connect(user))
            .using(
                () => {
                    return {
                        prices: MOCK_PRICES,
                        timestamp: Date.now()
                    }
                });

        //load user USD balance
        let testedUSD = MAX_COLLATERAL + 10;

        let usdForBorrower = 5 * MAX_COLLATERAL;
        let requiredAvax = toWei((usdForBorrower * USD_PRICE * 1.3 / AVAX_PRICE).toString());

        await wavaxTokenContract.connect(user).deposit({value: requiredAvax});
        await wavaxTokenContract.connect(user).transfer(exchange.address, requiredAvax);
        await exchange.connect(user).swap(toBytes32("USD"), toBytes32("USD"), requiredAvax, parseUnits(usdForBorrower.toString(), usdTokenDecimalPlaces));

        //fund a loan
        await usdTokenContract.connect(user).approve(loan.address, parseUnits(testedUSD.toString(), usdTokenDecimalPlaces));
        await loan.fund(toBytes32("USD"), parseUnits(testedUSD.toString(), usdTokenDecimalPlaces));
        await loan.withdraw(toBytes32("USD"), parseUnits(testedUSD.toString(), usdTokenDecimalPlaces));
    });

    it("should upgrade to new SmartLoan for competition purposes and test collateral limitations", async () => {
        const artifact = await recompileSmartLoan(SMART_LOAN_MOCK_UPGRADED, [0],{ "AVAX": usdPool.address }, exchange.address, yakRouterContract.address, 'mock');

        implementation = await deployContract(owner, artifact) as SmartLoan;
        const beaconAddress = await smartLoansFactory.connect(owner).upgradeableBeacon.call(0);
        const beacon = await (new UpgradeableBeacon__factory(owner).attach(beaconAddress));
        await beacon.upgradeTo(implementation.address);

        await usdTokenContract.connect(user).approve(loan.address, parseUnits((config.MAX_COLLATERAL + 10).toString(), usdTokenDecimalPlaces));
        await expect(loan.fund(toBytes32("USD"), parseUnits((MAX_COLLATERAL + 10).toString()))).to.be.revertedWith(`Adding more collateral than ${MAX_COLLATERAL} AVAX in total is not allowed`);

        await loan.fund(toBytes32("USD"), parseUnits(MAX_COLLATERAL.toString(), usdTokenDecimalPlaces));

        await expect(loan.fund(toBytes32("USD"), parseUnits("10", usdTokenDecimalPlaces))).to.be.revertedWith(`Adding more collateral than ${MAX_COLLATERAL} AVAX in total is not allowed`);

        await loan.withdraw(toBytes32("USD"), parseUnits("10", usdTokenDecimalPlaces));
        await loan.fund(toBytes32("USD"), parseUnits("10", usdTokenDecimalPlaces));
    });

    it("should test resetting collateral after closeLoan()", async () => {
        expect(fromWei(await loan.getTotalValue())).to.be.greaterThan(0);
        await loan.closeLoan();
        expect(fromWei(await loan.getTotalValue())).to.be.equal(0);
        await usdTokenContract.connect(user).approve(loan.address, parseUnits(MAX_COLLATERAL.toString(), usdTokenDecimalPlaces));
        await loan.fund(toBytes32("USD"), parseUnits(MAX_COLLATERAL.toString(), usdTokenDecimalPlaces));
    });

    it("should downgrade to old pool implementation and not require NFT access for deposit", async() => {
        await expect(usdPool.connect(owner).deposit(toWei("10.0"))).to.be.revertedWith("Access NFT required");

        await poolTUP.connect(admin).upgradeTo(poolImpl.address);

        await usdPool.connect(owner).deposit(toWei("10.0"));
        expect(await provider.getBalance(poolTUP.address)).to.equal(toWei("20"));
    });

});