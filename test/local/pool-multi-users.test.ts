import {waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import VariableUtilisationRatesCalculatorChangedOffsetArtifact
    from '../../artifacts/contracts/deprecated/VariableUtilisationRatesCalculatorChangedOffset.sol/VariableUtilisationRatesCalculatorChangedOffset.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {
    LinearIndex,
    OpenBorrowersRegistry__factory,
    Pool,
    VariableUtilisationRatesCalculator,
    VariableUtilisationRatesCalculatorChangedOffset
} from "../../typechain";

chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Pool with multiple users interactions', () => {

    describe('Deposit, borrow, wait & borrow more', () => {
        let pool: Pool,
            owner: SignerWithAddress,
            user1: SignerWithAddress,
            user2: SignerWithAddress,
            user3: SignerWithAddress,
            user4: SignerWithAddress,
            ratesCalculator: VariableUtilisationRatesCalculator;

        before("Deploy Pool contract", async () => {
            [owner, user1, user2, user3, user4] = await getFixedGasSigners(10000000);
            ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator);
            pool = (await deployContract(owner, PoolArtifact)) as Pool;
            const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            await pool.initialize(
                ratesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address
            );

        });

        it("user1 deposits", async () => {
            await pool.connect(user1).deposit({value: toWei("1.0")});
            expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1", "ether"));

            expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.000000, 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0, 0.000001);

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.03, 0.000001);
        });


        it("user2 borrows", async () => {
            await pool.connect(user2).borrow(toWei("0.9"));
            expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(0.1);

            expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.000000, 0.000001);
            expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(0.9, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.392229, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.438 , 0.000001);
        });


        it("should accumulate interest for first year", async () => {
            await time.increase(time.duration.years(1));
            expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(0.1);

            expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo( 1.392229, 0.000001);

            expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(1.2942, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.49051072383, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.530315968, 0.000001);
        });



        it("user3 deposits", async () => {
            await pool.connect(user3).deposit({value: toWei("1.0")});
            expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(1.1);

            expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo( 1.3922290124, 0.000001);
            expect(fromWei(await pool.balanceOf(user3.address))).to.be.closeTo(1, 0.000001);
            expect(fromWei(await pool.totalSupply())).to.be.closeTo(2, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.069313302, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.1076520015, 0.000001);
        });

        it("should accumulate interest for second year", async () => {
            await time.increase(time.duration.years(1));
            expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(1.1);

            expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.4887290028, 0.000001);
            expect(fromWei(await pool.balanceOf(user3.address))).to.be.closeTo( 1.06931330230, 0.000001);
            expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(1.433523248, 0.000001);
        });

        it("user4 borrows", async () => {
            await pool.connect(user4).borrow(toWei("0.5"));

            expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(0.6);

            expect(fromWei(await pool.getBorrowed(user4.address))).to.be.closeTo(0.5, 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo( 0.0707076382, 0.000001);

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.108555087312, 0.000001);
        });


        it("should accumulate interest for another year", async () => {
            await time.increase(time.duration.years(1));

            const poolBalance = fromWei(await provider.getBalance(pool.address));
            const depositUser1 = fromWei(await pool.balanceOf(user1.address));
            const depositUser3 = fromWei(await pool.balanceOf(user3.address));
            const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
            const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));

            expect(depositUser1).to.be.closeTo(1.59399351792, 0.000001);
            expect(depositUser3).to.be.closeTo(1.144921922817, 0.000001);
            expect(borrowedUser2).to.be.closeTo(1.58913947786, 0.000001);
            expect(borrowedUser4).to.be.closeTo(0.55427754361, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.07507960608, 0.000001);

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.11133185807, 0.000001);

            expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
        });

        it("user2 repays full loan", async () => {
            await pool.connect(user2).repay({value: await pool.getBorrowed(user2.address)});

            expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(2.18913948279, 0.000001);

            expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(0, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo( 0.0122107993, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.05620266031, 0.000001);
        });

        it("should accumulate interest for another year", async () => {
            await time.increase(time.duration.years(1));

            const poolBalance = fromWei(await provider.getBalance(pool.address));
            expect(poolBalance).to.be.closeTo( 2.189139477860, 0.000001);

            const depositUser1 = fromWei(await pool.balanceOf(user1.address));
            const depositUser3 = fromWei(await pool.balanceOf(user3.address));
            const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));
            const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));

            expect(depositUser1).to.be.closeTo(1.61345745630, 0.000001);
            expect(depositUser3).to.be.closeTo(1.158902337, 0.000001);
            expect(borrowedUser4).to.be.closeTo(0.58542941798, 0.000001);

            expect(depositUser1 + depositUser3).to.be.below(borrowedUser4 + borrowedUser2 + poolBalance);
        });

        it("user4 repays part of loan, user1 withdraws all deposit", async () => {
            await pool.connect(user4).repay({value: toWei("0.5")});

            const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
            const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));

            expect(borrowedUser2).to.be.closeTo( 0, 0.000001);
            expect(borrowedUser4).to.be.closeTo(0.085429418969, 0.000001);

            expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(2.68913947786, 0.000001);


            await pool.connect(user1).withdraw(await pool.balanceOf(user1.address));

            const depositUser1 = fromWei(await pool.balanceOf(user1.address));
            const depositUser3 = fromWei(await pool.balanceOf(user3.address));

            expect(depositUser1).to.be.closeTo( 0, 0.000001);
            expect(depositUser3).to.be.closeTo(1.15890233759, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.003421471772, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.04025153086, 0.000001);

            const poolBalance = fromWei(await provider.getBalance(pool.address));

            expect(poolBalance).to.be.closeTo(1.075682020941, 0.000001);

            expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
        });

        it("should accumulate interest for another year", async () => {
            await time.increase(time.duration.years(1));

            const poolBalance = fromWei(await provider.getBalance(pool.address));
            const depositUser1 = fromWei(await pool.balanceOf(user1.address));
            const depositUser3 = fromWei(await pool.balanceOf(user3.address));
            const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
            const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));

            expect(depositUser1).to.be.closeTo( 0, 0.000001);
            expect(depositUser3).to.be.closeTo(1.162867490319, 0.000001);
            expect(borrowedUser2).to.be.closeTo(0, 0.000001);
            expect(borrowedUser4).to.be.closeTo(0.088868083962, 0.000001);

            expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
        });
    });

    describe('Deposit, double borrow', () => {
        let pool: Pool,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            borrower: SignerWithAddress,
            ratesCalculator: VariableUtilisationRatesCalculator,
            depositIndex: LinearIndex,
            borrowingIndex: LinearIndex;

        before("Deploy Pool contract", async () => {
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator);
            pool = (await deployContract(owner, PoolArtifact)) as Pool;
            const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
            depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            await pool.initialize(
                ratesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address
            );

        });

        it("deposit", async () => {
            await pool.connect(depositor).deposit({value: toWei("1.0")});
            expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1", "ether"));

            expect(fromWei(await pool.balanceOf(depositor.address))).to.be.closeTo(1.000000, 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0, 0.000001);

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.03, 0.000001);
        });

        it("borrow", async () => {
            await pool.connect(borrower).borrow(toWei("0.5"));
            expect(await provider.getBalance(pool.address)).to.be.equal(toWei("0.5", "ether"));

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo( 0.044775, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.09, 0.000001);

            const poolBalance = fromWei(await provider.getBalance(pool.address));
            const deposits = fromWei(await pool.balanceOf(depositor.address));
            const borrowings = fromWei(await pool.getBorrowed(borrower.address));
            expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);

            expect(fromWei(await depositIndex.getIndexedValue(toWei("1"), depositor.address))).to.be.closeTo(1, 0.000001);
            expect(fromWei(await borrowingIndex.getIndexedValue(toWei("1"), borrower.address))).to.be.closeTo(1, 0.000001);

        });

        it("after 1 year", async () => {
            await time.increase(time.duration.years(1));
            await pool.connect(borrower).borrow(toWei("0.1"));

            const poolBalance = fromWei(await provider.getBalance(pool.address));
            const deposits = fromWei(await pool.balanceOf(depositor.address));
            const borrowings = fromWei(await pool.getBorrowed(borrower.address));
            expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
        });

        it("borrow more", async () => {
            await pool.connect(borrower).borrow(toWei("0.1"));

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.0819967561, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.115568663227, 0.000001);

            const poolBalance = fromWei(await provider.getBalance(pool.address));
            const deposits = fromWei(await pool.balanceOf(depositor.address));
            const borrowings = fromWei(await pool.getBorrowed(borrower.address));

            expect(deposits).to.be.closeTo(1.0447750035379, 0.000001);
            expect(borrowings).to.be.closeTo(0.74500000, 0.000001);

            expect(fromWei(await depositIndex.getIndex())).to.be.closeTo(1.044775003537, 0.000001);
            expect(fromWei(await borrowingIndex.getIndex())).to.be.closeTo(1.090000008, 0.000001);

            expect(fromWei(await depositIndex.getIndexedValue(toWei("1"), depositor.address))).to.be.closeTo(1.04477500353, 0.000001);
            expect(fromWei(await borrowingIndex.getIndexedValue(toWei("1"), borrower.address))).to.be.closeTo(1, 0.000001);

            expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
        });

        it("after 1 year", async () => {
            await time.increase(time.duration.years(1));

            expect(fromWei(await depositIndex.getIndex())).to.be.closeTo(1.13044316478, 0.000001);
            expect(fromWei(await borrowingIndex.getIndex())).to.be.closeTo(1.21596985242, 0.000001);

            const poolBalance = fromWei(await provider.getBalance(pool.address));
            const deposits = fromWei(await pool.balanceOf(depositor.address));
            const borrowings = fromWei(await pool.getBorrowed(borrower.address));

            expect(deposits).to.be.closeTo(1.13044316478, 0.000001);
            expect(borrowings).to.be.closeTo(0.83109865807, 0.000001);

            expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
        });

    });

    describe('Upgrading variable rates calculator', () => {
        let pool: Pool,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            borrower: SignerWithAddress,
            ratesCalculator: VariableUtilisationRatesCalculatorChangedOffset,
            updatedRatesCalculator: VariableUtilisationRatesCalculator,
            depositIndex: LinearIndex,
            borrowingIndex: LinearIndex;

        const SLOPE_1 =	0.12;
        const BREAKPOINT = 0.8;
        const MAX_RATE = 0.75;
        const OLD_OFFSET = 0.05;
        const NEW_OFFSET = 0.03;
        const SLOPE_2 = 3.12;
        const depositRateFactor = 995;

        function calculateBorrowingRate(utilisation: number, offset: number) {
            if (utilisation < BREAKPOINT) {
                return SLOPE_1 * utilisation + offset;
            } else {
                return SLOPE_2 * utilisation + MAX_RATE - SLOPE_2;
            }
        }

        function calculateDepositRate(utilisation: number, offset: number) {
            return calculateBorrowingRate(utilisation, offset) * utilisation * depositRateFactor / 1000;
        }

        before("Deploy Pool contract", async () => {
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorChangedOffsetArtifact) as VariableUtilisationRatesCalculatorChangedOffset);
            updatedRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator);
            pool = (await deployContract(owner, PoolArtifact)) as Pool;
            const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
            depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            await pool.initialize(
                ratesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address
            );

        });

        it("deposit and borrow and wait a year", async () => {
            await pool.connect(depositor).deposit({value: toWei("1.0")});
            expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1", "ether"));

            expect(fromWei(await pool.balanceOf(depositor.address))).to.be.closeTo(1.000000, 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0, 0.000001);

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.05, 0.000001);

            await pool.connect(borrower).borrow(toWei("0.5"));
            expect(await provider.getBalance(pool.address)).to.be.equal(toWei("0.5", "ether"));

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.054725, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.11, 0.000001);

            await time.increase(time.duration.years(1));
        });

        it("update rates calculator", async () => {
            const poolUtilisation = fromWei(await pool.totalBorrowed())/fromWei(await pool.totalSupply());

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(calculateBorrowingRate(poolUtilisation, OLD_OFFSET), 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(calculateDepositRate(poolUtilisation, OLD_OFFSET), 0.000001);

            await pool.setRatesCalculator(updatedRatesCalculator.address);

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(calculateBorrowingRate(poolUtilisation, NEW_OFFSET), 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(calculateDepositRate(poolUtilisation, NEW_OFFSET), 0.000001);
        });


        it("after 1 year", async () => {
            await time.increase(time.duration.years(1));

            const poolUtilisation = fromWei(await pool.totalBorrowed())/fromWei(await pool.totalSupply());

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(calculateBorrowingRate(poolUtilisation, NEW_OFFSET), 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(calculateDepositRate(poolUtilisation, NEW_OFFSET), 0.000001);

            const poolBalance = fromWei(await provider.getBalance(pool.address));
            const deposits = fromWei(await pool.balanceOf(depositor.address));
            const borrowings = fromWei(await pool.getBorrowed(borrower.address));

            expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
        });
    });
});
