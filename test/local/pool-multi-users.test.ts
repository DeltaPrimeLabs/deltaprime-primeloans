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

    // describe('Deposit, borrow, wait & borrow more', () => {
    //     let pool: Pool,
    //         owner: SignerWithAddress,
    //         user1: SignerWithAddress,
    //         user2: SignerWithAddress,
    //         user3: SignerWithAddress,
    //         user4: SignerWithAddress,
    //         ratesCalculator: VariableUtilisationRatesCalculator;
    //
    //     before("Deploy Pool contract", async () => {
    //         [owner, user1, user2, user3, user4] = await getFixedGasSigners(10000000);
    //         ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator);
    //         pool = (await deployContract(owner, PoolArtifact)) as Pool;
    //         const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
    //         const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
    //         await depositIndex.initialize(pool.address);
    //         const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
    //         await borrowingIndex.initialize(pool.address);
    //
    //         await pool.initialize(
    //             ratesCalculator.address,
    //             borrowersRegistry.address,
    //             depositIndex.address,
    //             borrowingIndex.address
    //         );
    //
    //     });
    //
    //     it("user1 deposits", async () => {
    //         await pool.connect(user1).deposit({value: toWei("1.0")});
    //         expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1", "ether"));
    //
    //         expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.000000, 0.000001);
    //         expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0, 0.000001);
    //
    //         expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.05, 0.000001);
    //     });
    //
    //
    //     it("user2 borrows", async () => {
    //         await pool.connect(user2).borrow(toWei("0.9"));
    //         expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(0.1);
    //
    //         expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.000000, 0.000001);
    //         expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(0.9, 0.000001);
    //
    //         expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.4032, 0.000001);
    //         expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.448 , 0.000001);
    //     });
    //
    //
    //     it("should accumulate interest for first year", async () => {
    //         await time.increase(time.duration.years(1));
    //         expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(0.1);
    //
    //         expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.4032, 0.000001);
    //
    //         expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(1.3032, 0.000001);
    //         expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.4966663729772224, 0.000001);
    //
    //         expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.5347776637598227, 0.000001);
    //     });
    //
    //
    //
    //     it("user3 deposits", async () => {
    //         await pool.connect(user3).deposit({value: toWei("1.0")});
    //         expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(1.1);
    //
    //         expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.4032, 0.000001);
    //         expect(fromWei(await pool.balanceOf(user3.address))).to.be.closeTo(1, 0.000001);
    //         expect(fromWei(await pool.totalSupply())).to.be.closeTo(2, 0.000001);
    //
    //         expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.0835299072, 0.000001);
    //         expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.128192, 0.000001);
    //     });
    //
    //     it("should accumulate interest for second year", async () => {
    //         await time.increase(time.duration.years(1));
    //         expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(1.1);
    //
    //         expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.52040916578, 0.000001);
    //         expect(fromWei(await pool.balanceOf(user3.address))).to.be.closeTo( 1.0835299072, 0.000001);
    //         expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(1.4702598144, 0.000001);
    //     });
    //
    //     it("user4 borrows", async () => {
    //         await pool.connect(user4).borrow(toWei("0.5"));
    //
    //         expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(0.6);
    //
    //         expect(fromWei(await pool.getBorrowed(user4.address))).to.be.closeTo(0.5, 0.000001);
    //         expect(fromWei(await pool.getDepositRate())).to.be.closeTo( 0.08238542952570631, 0.000001);
    //
    //         expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.12752439486817152, 0.000001);
    //     });
    //
    //
    //     it("should accumulate interest for another year", async () => {
    //         await time.increase(time.duration.years(1));
    //
    //         const poolBalance = fromWei(await provider.getBalance(pool.address));
    //         const depositUser1 = fromWei(await pool.balanceOf(user1.address));
    //         const depositUser3 = fromWei(await pool.balanceOf(user3.address));
    //         const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
    //         const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));
    //
    //         expect(depositUser1).to.be.closeTo(1.64566872796, 0.000001);
    //         expect(depositUser3).to.be.closeTo(1.17279698401, 0.000001);
    //         expect(borrowedUser2).to.be.closeTo(1.65775380753, 0.000001);
    //         expect(borrowedUser4).to.be.closeTo(0.56376219743, 0.000001);
    //
    //         expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.08799691716079858, 0.000001);
    //
    //         expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.13075741136816763, 0.000001);
    //
    //         expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
    //     });
    //
    //     it("user2 repays full loan", async () => {
    //         await pool.connect(user2).repay({value: await pool.getBorrowed(user2.address)});
    //
    //         expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(2.25775380753, 0.000001);
    //
    //         expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(0, 0.000001);
    //
    //         expect(fromWei(await pool.getDepositRate())).to.be.closeTo( 0.016111031148310317, 0.000001);
    //         expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.07557987482979014, 0.000001);
    //     });
    //
    //     it("should accumulate interest for another year", async () => {
    //         await time.increase(time.duration.years(1));
    //
    //         const poolBalance = fromWei(await provider.getBalance(pool.address));
    //         expect(poolBalance).to.be.closeTo(2.25775380753, 0.000001);
    //
    //         const depositUser1 = fromWei(await pool.balanceOf(user1.address));
    //         const depositUser3 = fromWei(await pool.balanceOf(user3.address));
    //         const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));
    //         expect(depositUser1).to.be.closeTo(1.6721821481, 0.000001);
    //         expect(depositUser3).to.be.closeTo(1.19169195275, 0.000001);
    //         expect(borrowedUser4).to.be.closeTo(0.60637127374, 0.000001);
    //
    //         expect(depositUser1 + depositUser3).to.be.below(borrowedUser4 + poolBalance);
    //     });
    //
    //     it("user4 repays part of loan, user1 withdraws all deposit", async () => {
    //         await pool.connect(user4).repay({value: toWei("0.5")});
    //
    //         const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
    //         const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));
    //
    //         expect(borrowedUser2).to.be.closeTo( 0, 0.000001);
    //         expect(borrowedUser4).to.be.closeTo(0.10637127374, 0.000001);
    //
    //         expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(2.757753796871958, 0.000001);
    //
    //
    //         await pool.connect(user1).withdraw(await pool.balanceOf(user1.address));
    //
    //         const depositUser1 = fromWei(await pool.balanceOf(user1.address));
    //         const depositUser3 = fromWei(await pool.balanceOf(user3.address));
    //
    //         expect(depositUser1).to.be.closeTo( 0, 0.000001);
    //         expect(depositUser3).to.be.closeTo(1.19169195275, 0.000001);
    //
    //         expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.006676345116221877, 0.000001);
    //         expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.06276455234669974, 0.000001);
    //
    //         const poolBalance = fromWei(await provider.getBalance(pool.address));
    //
    //         expect(poolBalance).to.be.closeTo(1.08557165943, 0.000001);
    //
    //         expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
    //     });
    //
    //     it("should accumulate interest for another year", async () => {
    //         await time.increase(time.duration.years(1));
    //
    //         const poolBalance = fromWei(await provider.getBalance(pool.address));
    //         const depositUser1 = fromWei(await pool.balanceOf(user1.address));
    //         const depositUser3 = fromWei(await pool.balanceOf(user3.address));
    //         const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
    //         const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));
    //
    //         expect(depositUser1).to.be.closeTo( 0, 0.000001);
    //         expect(depositUser3).to.be.closeTo(1.1996480995, 0.000001);
    //         expect(borrowedUser2).to.be.closeTo(0, 0.000001);
    //         expect(borrowedUser4).to.be.closeTo(0.11304761911, 0.000001);
    //
    //         //expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
    //     });
    // });
    //
    // describe('Deposit, double borrow', () => {
    //     let pool: Pool,
    //         owner: SignerWithAddress,
    //         depositor: SignerWithAddress,
    //         borrower: SignerWithAddress,
    //         ratesCalculator: VariableUtilisationRatesCalculator,
    //         depositIndex: LinearIndex,
    //         borrowingIndex: LinearIndex;
    //
    //     before("Deploy Pool contract", async () => {
    //         [owner, depositor, borrower] = await getFixedGasSigners(10000000);
    //         ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator);
    //         pool = (await deployContract(owner, PoolArtifact)) as Pool;
    //         const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
    //         depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
    //         await depositIndex.initialize(pool.address);
    //         borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
    //         await borrowingIndex.initialize(pool.address);
    //
    //         await pool.initialize(
    //             ratesCalculator.address,
    //             borrowersRegistry.address,
    //             depositIndex.address,
    //             borrowingIndex.address
    //         );
    //
    //     });
    //
    //     it("deposit", async () => {
    //         await pool.connect(depositor).deposit({value: toWei("1.0")});
    //         expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1", "ether"));
    //
    //         expect(fromWei(await pool.balanceOf(depositor.address))).to.be.closeTo(1.000000, 0.000001);
    //         expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0, 0.000001);
    //
    //         expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.05, 0.000001);
    //     });
    //
    //     it("borrow", async () => {
    //         await pool.connect(borrower).borrow(toWei("0.5"));
    //         expect(await provider.getBalance(pool.address)).to.be.equal(toWei("0.5", "ether"));
    //
    //         expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.055, 0.000001);
    //         expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.11, 0.000001);
    //
    //         const poolBalance = fromWei(await provider.getBalance(pool.address));
    //         const deposits = fromWei(await pool.balanceOf(depositor.address));
    //         const borrowings = fromWei(await pool.getBorrowed(borrower.address));
    //         expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
    //
    //         expect(fromWei(await depositIndex.getIndexedValue(toWei("1"), depositor.address))).to.be.closeTo(1, 0.000001);
    //         expect(fromWei(await borrowingIndex.getIndexedValue(toWei("1"), borrower.address))).to.be.closeTo(1, 0.000001);
    //
    //     });
    //
    //     it("after 1 year", async () => {
    //         await time.increase(time.duration.years(1));
    //         await pool.connect(borrower).borrow(toWei("0.1"));
    //
    //         const poolBalance = fromWei(await provider.getBalance(pool.address));
    //         const deposits = fromWei(await pool.balanceOf(depositor.address));
    //         const borrowings = fromWei(await pool.getBorrowed(borrower.address));
    //         expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
    //     });
    //
    //     it("borrow more", async () => {
    //         await pool.connect(borrower).borrow(toWei("0.1"));
    //
    //         expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.09723883111340716, 0.000001);
    //         expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.13587677725118483, 0.000001);
    //
    //         const poolBalance = fromWei(await provider.getBalance(pool.address));
    //         const deposits = fromWei(await pool.balanceOf(depositor.address));
    //         const borrowings = fromWei(await pool.getBorrowed(borrower.address));
    //
    //         expect(deposits).to.be.closeTo(1.055, 0.000001);
    //         expect(borrowings).to.be.closeTo(0.755, 0.000001);
    //
    //         expect(fromWei(await depositIndex.getIndex())).to.be.closeTo(1.055, 0.000001);
    //         expect(fromWei(await borrowingIndex.getIndex())).to.be.closeTo(1.11, 0.000001);
    //
    //         expect(fromWei(await depositIndex.getIndexedValue(toWei("1"), depositor.address))).to.be.closeTo(1.055, 0.000001);
    //         expect(fromWei(await borrowingIndex.getIndexedValue(toWei("1"), borrower.address))).to.be.closeTo(1, 0.000001);
    //
    //         expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
    //     });
    //
    //     it("after 1 year", async () => {
    //         await time.increase(time.duration.years(1));
    //
    //         expect(fromWei(await depositIndex.getIndex())).to.be.closeTo(1.15758696682464, 0.000001);
    //         expect(fromWei(await borrowingIndex.getIndex())).to.be.closeTo(1.260823222749, 0.000001);
    //
    //         const poolBalance = fromWei(await provider.getBalance(pool.address));
    //         const deposits = fromWei(await pool.balanceOf(depositor.address));
    //         const borrowings = fromWei(await pool.getBorrowed(borrower.address));
    //
    //         expect(deposits).to.be.closeTo(1.1575869738722644, 0.000001);
    //         expect(borrowings).to.be.closeTo(0.8575869718486621, 0.000001);
    //
    //         expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
    //     });
    //
    // });

    describe('Upgrading variable rates calculator', () => {
        let pool: Pool,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            borrower: SignerWithAddress,
            ratesCalculator: VariableUtilisationRatesCalculator,
            depositIndex: LinearIndex,
            borrowingIndex: LinearIndex;

        before("Deploy Pool contract", async () => {
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorChangedOffsetArtifact) as VariableUtilisationRatesCalculatorChangedOffset);
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

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.055, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.11, 0.000001);

            await time.increase(time.duration.years(1));
        });

        it("update rates calculator", async () => {
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.055, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.11, 0.000001);

            //TODO: check pool utilization and the deposit/borrowing rate for it

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.055, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.11, 0.000001);
        });


        it("after 1 year", async () => {
            await time.increase(time.duration.years(1));

            expect(fromWei(await depositIndex.getIndex())).to.be.closeTo(1.15758696682464, 0.000001);
            expect(fromWei(await borrowingIndex.getIndex())).to.be.closeTo(1.260823222749, 0.000001);

            const poolBalance = fromWei(await provider.getBalance(pool.address));
            const deposits = fromWei(await pool.balanceOf(depositor.address));
            const borrowings = fromWei(await pool.getBorrowed(borrower.address));

            expect(deposits).to.be.closeTo(1.1575869738722644, 0.000001);
            expect(borrowings).to.be.closeTo(0.8575869718486621, 0.000001);

            expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
        });
    });
});
