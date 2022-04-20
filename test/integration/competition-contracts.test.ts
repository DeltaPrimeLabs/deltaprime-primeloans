import {waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';
import {Contract} from "ethers";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import MockBorrowAccessNFTArtifact from '../../artifacts/contracts/mock/MockBorrowAccessNFT.sol/MockBorrowAccessNFT.json';
import MockDepositAccessNFTArtifact from '../../artifacts/contracts/mock/MockDepositAccessNFT.sol/MockDepositAccessNFT.json';
import PoolWithAccessNFTArtifact
    from '../../artifacts/contracts/upgraded/PoolWithAccessNFT.sol/PoolWithAccessNFT.json';
import PoolTUPArtifact from '../../artifacts/contracts/proxies/PoolTUP.sol/PoolTUP.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
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
    MockSmartLoanRedstoneProviderLimitedCollateral, MockSmartLoanRedstoneProviderLimitedCollateral__factory,
    MockSmartLoanRedstoneProvider__factory,
    PangolinExchange,
    Pool,
    Pool__factory,
    PoolTUP,
    PoolWithAccessNFT,
    PoolWithAccessNFT__factory,
    SmartLoan,
    SmartLoanLimitedCollateral,
    SmartLoansFactory,
    SmartLoansFactory__factory,
    SmartLoansFactoryTUP,
    UpgradeableBeacon__factory, YieldYakRouter__factory,
} from "../../typechain";
import {WrapperBuilder} from "redstone-evm-connector";

chai.use(solidity);

const SMART_LOAN_MOCK = "MockSmartLoanRedstoneProvider";
const SMART_LOAN_MOCK_UPGRADED = "MockSmartLoanRedstoneProviderLimitedCollateral";
const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const usdTokenAddress = '0xc7198437980c041c805a1edcba50c1ce5db95118';
const WAVAXTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

describe('Trading competition upgraded contracts test', () => {
    let SLImpl: SmartLoan,
        SL: SmartLoan,
        SLUpgraded: SmartLoanLimitedCollateral,
        SLFImpl: Contract,
        SLF: SmartLoansFactory,
        SLFTUP: SmartLoansFactoryTUP,
        pool: Pool,
        poolImpl: Pool,
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

        // Access NFTs
        borrowNFT = (await deployContract(owner, MockBorrowAccessNFTArtifact)) as MockBorrowAccessNFT;
        depositNFT = (await deployContract(owner, MockDepositAccessNFTArtifact)) as MockDepositAccessNFT;

        // Variable Rate Calculator
        mockVariableUtilisationRatesCalculator = await deployMockContract(owner, VariableUtilisationRatesCalculatorArtifact.abi);
        await mockVariableUtilisationRatesCalculator.mock.calculateDepositRate.returns(toWei("0.05"));
        await mockVariableUtilisationRatesCalculator.mock.calculateBorrowingRate.returns(toWei("0.05"));

        // Not upgraded Pool with TUP
        poolImpl = (await deployContract(owner, PoolArtifact)) as Pool;
        poolTUP = (await deployContract(owner, PoolTUPArtifact, [poolImpl.address, admin.address, []])) as PoolTUP;
        pool = await new Pool__factory(owner).attach(poolTUP.address);
        yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

        // Borrow/Deposit indices
        const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
        const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

        // Assets exchange (without TUP)
        exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
            new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
            new Asset(toBytes32('USD'), usdTokenAddress)
        ]);

        // Smart Loan Implementation
        const artifact = await recompileSmartLoan(SMART_LOAN_MOCK, pool.address, exchange.address, yakRouterContract.address, 'mock');
        SLImpl = await deployContract(owner, artifact) as SmartLoan;

        // Not upgraded SLF with TUP
        SLFImpl = (await deployContract(owner, SmartLoansFactoryArtifact)) as SmartLoansFactory;
        SLFTUP = (await deployContract(owner, SmartLoansFactoryTUPArtifact, [SLFImpl.address, admin.address, []])) as SmartLoansFactoryTUP;
        SLF = await new SmartLoansFactory__factory(owner).attach(SLFTUP.address);

        await SLF.connect(owner).initialize(SLImpl.address);

        await pool.initialize(
            mockVariableUtilisationRatesCalculator.address,
            SLF.address,
            depositIndex.address,
            borrowingIndex.address
        );
    });

    it("should deposit requested value without the access ERC721", async () => {
        await pool.connect(depositor).deposit({value: toWei("1.0")});
        expect(await provider.getBalance(pool.address)).to.equal(toWei("1"));

        const currentDeposits = await pool.balanceOf(depositor.address);
        expect(fromWei(currentDeposits)).to.equal(1);

        await pool.connect(depositor).withdraw(toWei("1.0"));
    });

    it("should deposit requested value only with the access ERC721", async () => {
        // Upgrade the pool
        const poolUpgradedImpl = await (deployContract(owner, PoolWithAccessNFTArtifact)) as PoolWithAccessNFT;
        await poolTUP.connect(admin).upgradeTo(poolUpgradedImpl.address);
        poolUpgraded = await new PoolWithAccessNFT__factory(owner).attach(poolTUP.address);
        
        // Set NFT access
        await poolUpgraded.connect(owner).setAccessNFT(borrowNFT.address);

        await expect(poolUpgraded.connect(depositor).deposit({value: toWei("10.0")})).to.be.revertedWith("Access NFT required");

        await borrowNFT.connect(owner).addAvailableUri(["uri_1", "uri_2"]);
        await borrowNFT.connect(depositor).safeMint("580528284777971734", "0x536aac0a69dea94674eb85fbad6dadf0460ac6de584a3429f1c39e99de67a72d7e7c2f246ab9c022d9341c26d187744ad8ccdfc5986cfc74e1fa2a5e1a4555381b");

        await poolUpgraded.connect(depositor).deposit({value: toWei("10.0")});

        expect(await provider.getBalance(poolTUP.address)).to.equal(toWei("10"));
    });

    it("should add and withdraw more than 1.25 collateral in total with the base SL contract version", async () => {
        await SLF.connect(user).createLoan();
        const SLAddress = await SLF.getLoanForOwner(user.address);
        SL = await (new MockSmartLoanRedstoneProvider__factory(user).attach(SLAddress));
        SL = WrapperBuilder
            .mockLite(SL.connect(user))
            .using(
                () => {
                    return {
                        prices: MOCK_PRICES,
                        timestamp: Date.now()
                    }
                })

        await SL.fund({value: toWei("2")});
        await SL.withdraw(toWei("2"));
    });

    it("should upgrade to new SmartLoan for competition purposes and test collateral limitations", async () => {
        const artifact = await recompileSmartLoan(SMART_LOAN_MOCK_UPGRADED, pool.address, exchange.address, yakRouterContract.address, 'mock');

        SLImpl = await deployContract(owner, artifact) as SmartLoan;
        const beaconAddress = await SLF.connect(owner).upgradeableBeacon.call(0);
        const beacon = await (new UpgradeableBeacon__factory(owner).attach(beaconAddress));
        await beacon.upgradeTo(SLImpl.address);

        await expect(SL.fund({value: toWei("7.5")})).to.be.revertedWith("Adding more collateral than 7 AVAX in total is not allowed");

        await SL.fund({value: toWei("7")});

        await expect(SL.fund({value: toWei("0.1")})).to.be.revertedWith("Adding more collateral than 7 AVAX in total is not allowed");

        await SL.withdraw(toWei("0.5"));
        await SL.fund({value: toWei("0.1")});
    });

    it("should test resetting collateral after closeLoan()", async () => {
        expect(fromWei(await SL.getTotalValue())).to.be.greaterThan(0);
        await SL.closeLoan();
        expect(fromWei(await SL.getTotalValue())).to.be.equal(0);
        await SL.fund({value: toWei("1")});
    });

    it("should downgrade to old pool implementation and not require NFT access for deposit", async() => {
       await expect(pool.connect(owner).deposit({value: toWei("10.0")})).to.be.revertedWith("Access NFT required");

       await poolTUP.connect(admin).upgradeTo(poolImpl.address);

       await pool.connect(owner).deposit({value: toWei("10.0")});
       expect(await provider.getBalance(poolTUP.address)).to.equal(toWei("20"));
    });

});