import {waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import ERC20PoolArtifact from '../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import VariableUtilisationRatesCalculatorChangedOffsetArtifact
    from '../../artifacts/contracts/deprecated/VariableUtilisationRatesCalculatorChangedOffset.sol/VariableUtilisationRatesCalculatorChangedOffset.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {
    LinearIndex, MockToken,
    OpenBorrowersRegistry__factory,
    ERC20Pool,
    VariableUtilisationRatesCalculator,
    VariableUtilisationRatesCalculatorChangedOffset
} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;

describe('Pool with multiple users interactions', () => {

    describe('Deposit, borrow, wait & borrow more', () => {
        let pool: ERC20Pool,
            owner: SignerWithAddress,
            user1: SignerWithAddress,
            user2: SignerWithAddress,
            user3: SignerWithAddress,
            user4: SignerWithAddress,
            mockToken: Contract,
            ratesCalculator: VariableUtilisationRatesCalculator;

        before("Deploy Pool contract", async () => {
            [owner, user1, user2, user3, user4] = await getFixedGasSigners(10000000);
            ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator);
            pool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;

            mockToken = (await deployContract(owner, MockTokenArtifact, [[owner.address, user1.address, user2.address, user3.address, user4.address]])) as MockToken;

            const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            await pool.initialize(
                ratesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                mockToken.address
            );
        });

        it("user1 deposits", async () => {
            await mockToken.connect(user1).approve(pool.address, toWei("1.0"));
            await pool.connect(user1).deposit(toWei("1.0"));

            expect(await mockToken.balanceOf(pool.address)).to.be.equal(toWei("1", "ether"));

            expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.000000, 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0, 0.000001);

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.03, 0.000001);
        });


        it("user2 borrows", async () => {
            await pool.connect(user2).borrow(toWei("0.9"));
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.equal(0.1);

            expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.000000, 0.000001);
            expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(0.9, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.3914996085, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.435, 0.000001);
        });


        it("should accumulate interest for first year", async () => {
            await time.increase(time.duration.years(1));
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.equal(0.1);

            expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo( 1.3914996085, 0.000001);

            expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(1.2915, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.4859957010109852, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.5236264064676522, 0.000001);
        });



        it("user3 deposits", async () => {
            await mockToken.connect(user3).approve(pool.address, toWei("1.0"));
            await pool.connect(user3).deposit(toWei("1.0"));
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.equal(1.1);

            expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo( 1.3914996333287424, 0.000001);
            expect(fromWei(await pool.balanceOf(user3.address))).to.be.closeTo(1, 0.000001);
            expect(fromWei(await pool.totalSupply())).to.be.closeTo(2.3914996333287424, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.016201115592868784, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.03, 0.000001);
        });

        it("should accumulate interest for second year", async () => {
            await time.increase(time.duration.years(1));
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.equal(1.1);

            expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.4140434797357357, 0.000001);
            expect(fromWei(await pool.balanceOf(user3.address))).to.be.closeTo( 1.0162011161066027, 0.000001);
            expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(1.3302450255736302, 0.000001);
        });

        it("user4 borrows", async () => {
            await mockToken.connect(user4).approve(pool.address, toWei("0.5"));
            await pool.connect(user4).borrow(toWei("0.5"));

            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.equal(0.6);

            expect(fromWei(await pool.getBorrowed(user4.address))).to.be.closeTo(0.5, 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo( 0.07448276189573219, 0.000001);

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo( 0.09890015165583, 0.000001);
        });


        it("should accumulate interest for another year", async () => {
            await time.increase(time.duration.years(1));

            const poolBalance = fromWei(await mockToken.balanceOf(pool.address));
            const depositUser1 = fromWei(await pool.balanceOf(user1.address));
            const depositUser3 = fromWei(await pool.balanceOf(user3.address));
            const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
            const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));

            expect(depositUser1).to.be.closeTo(1.5193653450833162, 0.000001);
            expect(depositUser3).to.be.closeTo(1.0918905830352734, 0.000001);
            expect(borrowedUser2).to.be.closeTo(1.4618064629677694, 0.000001);
            expect(borrowedUser4).to.be.closeTo(0.5494500760921107, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.08210720278047828, 0.000001);

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.106601584666613, 0.000001);

            expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
        });

        it("user2 repays full loan", async () => {
            const toRepay = await pool.getBorrowed(user2.address);
            await mockToken.connect(user2).approve(pool.address, toRepay);
            await pool.connect(user2).repay(toRepay);

            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(2.0618064629677693, 0.000001);

            expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(0, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo( 0.006312474316312758, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.03, 0.000001);
        });

        it("should accumulate interest for another year", async () => {
            await time.increase(time.duration.years(1));

            const poolBalance = fromWei(await mockToken.balanceOf(pool.address));
            expect(poolBalance).to.be.closeTo(2.0618064777968073, 0.000001);

            const depositUser1 = fromWei(await pool.balanceOf(user1.address));
            const depositUser3 = fromWei(await pool.balanceOf(user3.address));
            const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));
            const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));

            expect(depositUser1).to.be.closeTo(1.5289563065733205, 0.000001);
            expect(depositUser3).to.be.closeTo(1.0987831187708486, 0.000001);
            expect(borrowedUser4).to.be.closeTo(0.5659335813040133, 0.000001);

            expect(depositUser1 + depositUser3).to.be.below(borrowedUser4 + borrowedUser2 + poolBalance);
        });

        it("user4 repays part of loan, user1 withdraws all deposit", async () => {
            await mockToken.connect(user4).approve(pool.address, toWei("0.5"));
            await pool.connect(user4).repay(toWei("0.5"));

            const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
            const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));

            expect(borrowedUser2).to.be.closeTo( 0, 0.000001);
            expect(borrowedUser4).to.be.closeTo(0.06593358287207855, 0.000001);

            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(2.5618064629677693, 0.000001);


            await pool.connect(user1).withdraw(await pool.balanceOf(user1.address));

            const depositUser1 = fromWei(await pool.balanceOf(user1.address));
            const depositUser3 = fromWei(await pool.balanceOf(user3.address));

            expect(depositUser1).to.be.closeTo( 0, 0.000001);
            expect(depositUser3).to.be.closeTo(1.0987831190156365, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.001800178504633681, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.03, 0.000001);

            const poolBalance = fromWei(await mockToken.balanceOf(pool.address));

            expect(poolBalance).to.be.closeTo(1.0328501557861944, 0.000001);

            expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
        });

        it("should accumulate interest for another year", async () => {
            await time.increase(time.duration.years(1));

            const poolBalance = fromWei(await mockToken.balanceOf(pool.address));
            const depositUser1 = fromWei(await pool.balanceOf(user1.address));
            const depositUser3 = fromWei(await pool.balanceOf(user3.address));
            const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
            const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));

            expect(depositUser1).to.be.closeTo( 0, 0.000001);
            expect(depositUser3).to.be.closeTo(1.1007611247677427, 0.000001);
            expect(borrowedUser2).to.be.closeTo(0, 0.000001);
            expect(borrowedUser4).to.be.closeTo(0.0679115898844757, 0.000001);

            //TODO: check this scenario
            expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
        });
    });

    describe('Deposit, double borrow', () => {
        let pool: ERC20Pool,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            borrower: SignerWithAddress,
            ratesCalculator: VariableUtilisationRatesCalculator,
            depositIndex: LinearIndex,
            borrowingIndex: LinearIndex,
            mockToken: Contract;

        before("Deploy Pool contract", async () => {
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator);
            pool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
            const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
            depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            mockToken = (await deployContract(owner, MockTokenArtifact, [[owner.address, depositor.address, borrower.address]])) as MockToken;

            await pool.initialize(
                ratesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                mockToken.address
            );

        });

        it("deposit", async () => {
            await mockToken.connect(depositor).approve(pool.address, toWei("1.0"));
            await pool.connect(depositor).deposit(toWei("1.0"));

            expect(await mockToken.balanceOf(pool.address)).to.be.equal(toWei("1", "ether"));

            expect(fromWei(await pool.balanceOf(depositor.address))).to.be.closeTo(1.000000, 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0, 0.000001);

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.03, 0.000001);
        });

        it("borrow", async () => {
            await pool.connect(borrower).borrow(toWei("0.5"));
            expect(await mockToken.balanceOf(pool.address)).to.be.equal(toWei("0.5", "ether"));

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo( 0.014999985, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.03, 0.000001);

            const poolBalance = fromWei(await mockToken.balanceOf(pool.address));
            const deposits = fromWei(await pool.balanceOf(depositor.address));
            const borrowings = fromWei(await pool.getBorrowed(borrower.address));
            expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);

            expect(fromWei(await depositIndex.getIndexedValue(toWei("1"), depositor.address))).to.be.closeTo(1, 0.000001);
            expect(fromWei(await borrowingIndex.getIndexedValue(toWei("1"), borrower.address))).to.be.closeTo(1, 0.000001);

        });

        it("after 1 year", async () => {
            await time.increase(time.duration.years(1));
            await pool.connect(borrower).borrow(toWei("0.1"));

            const poolBalance = fromWei(await mockToken.balanceOf(pool.address));
            const deposits = fromWei(await pool.balanceOf(depositor.address));
            const borrowings = fromWei(await pool.getBorrowed(borrower.address));
            expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
        });

        it("borrow more", async () => {
            await pool.connect(borrower).borrow(toWei("0.1"));

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.05423785918589893, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.07699507872207254, 0.000001);

            const poolBalance = fromWei(await mockToken.balanceOf(pool.address));
            const deposits = fromWei(await pool.balanceOf(depositor.address));
            const borrowings = fromWei(await pool.getBorrowed(borrower.address));

            expect(deposits).to.be.closeTo(1.0149999861125676, 0.000001);
            expect(borrowings).to.be.closeTo(0.7150000011125686, 0.000001);

            expect(fromWei(await depositIndex.getIndex())).to.be.closeTo(1.0149999861125676, 0.000001);
            expect(fromWei(await borrowingIndex.getIndex())).to.be.closeTo(1.030000004957506, 0.000001);

            expect(fromWei(await depositIndex.getIndexedValue(toWei("1"), depositor.address))).to.be.closeTo(1.0149999861125676, 0.000001);
            expect(fromWei(await borrowingIndex.getIndexedValue(toWei("1"), borrower.address))).to.be.closeTo(1, 0.000001);

            expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
        });

        it("after 1 year", async () => {
            await time.increase(time.duration.years(1));

            expect(fromWei(await depositIndex.getIndex())).to.be.closeTo(1.0700514124330303, 0.000001);
            expect(fromWei(await borrowingIndex.getIndex())).to.be.closeTo(1.1093049364229441, 0.000001);

            const poolBalance = fromWei(await mockToken.balanceOf(pool.address));
            const deposits = fromWei(await pool.balanceOf(depositor.address));
            const borrowings = fromWei(await pool.getBorrowed(borrower.address));

            expect(deposits).to.be.closeTo(1.0700514124330303, 0.000001);
            expect(borrowings).to.be.closeTo(0.7700514824845127, 0.000001);

            expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
        });

    });

    describe('Upgrading variable rates calculator', () => {
        let pool: ERC20Pool,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            borrower: SignerWithAddress,
            ratesCalculator: VariableUtilisationRatesCalculatorChangedOffset,
            updatedRatesCalculator: VariableUtilisationRatesCalculator,
            depositIndex: LinearIndex,
            borrowingIndex: LinearIndex,
            mockToken: Contract;

        const SLOPE_1 = 0;
        const OFFSET_1_INIT = 0.05;
        const OFFSET_1_UPDATE = 0.03;
        const BREAKPOINT_1 = 0.6;

        const SLOPE_2 = 0.45;
        const OFFSET_2 = 0.24;
        const BREAKPOINT_2 = 0.8;

        const SLOPE_3 = 3.15;
        const OFFSET_3 = 2.4;

        const depositRateFactor = 1e18 - 1e12;

        function calculateBorrowingRate(utilisation: number, offset_1: number) {
            if (utilisation < BREAKPOINT_1) {
                return SLOPE_1 * utilisation + offset_1;
            } else if (utilisation < BREAKPOINT_2) {
                return SLOPE_2 * utilisation + OFFSET_2;
            } else {
                return SLOPE_3 * utilisation + OFFSET_3;
            }
        }

        function calculateDepositRate(utilisation: number, offset: number) {
            return calculateBorrowingRate(utilisation, offset) * utilisation * depositRateFactor / 1e18;
        }

        before("Deploy Pool contract", async () => {
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorChangedOffsetArtifact) as VariableUtilisationRatesCalculatorChangedOffset);
            updatedRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator);
            pool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
            const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
            depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);
            mockToken = (await deployContract(owner, MockTokenArtifact, [[owner.address, depositor.address, borrower.address]])) as MockToken;

            await pool.initialize(
                ratesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                mockToken.address
            );

        });

        it("deposit and borrow and wait a year", async () => {
            await mockToken.connect(depositor).approve(pool.address, toWei("1.0"));
            await pool.connect(depositor).deposit(toWei("1.0"));

            expect(await mockToken.balanceOf(pool.address)).to.be.equal(toWei("1", "ether"));

            expect(fromWei(await pool.balanceOf(depositor.address))).to.be.closeTo(1.000000, 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0, 0.000001);

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.05, 0.000001);

            await pool.connect(borrower).borrow(toWei("0.5"));

            expect(await mockToken.balanceOf(pool.address)).to.be.equal(toWei("0.5", "ether"));

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.024999975, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.05, 0.000001);

            await time.increase(time.duration.years(1));
        });

        it("update rates calculator", async () => {
            const poolUtilisation = fromWei(await pool.totalBorrowed())/fromWei(await pool.totalSupply());

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(calculateBorrowingRate(poolUtilisation, OFFSET_1_INIT), 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(calculateDepositRate(poolUtilisation, OFFSET_1_INIT), 0.000001);

            await pool.setRatesCalculator(updatedRatesCalculator.address);

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(calculateBorrowingRate(poolUtilisation, OFFSET_1_UPDATE), 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(calculateDepositRate(poolUtilisation, OFFSET_1_UPDATE), 0.000001);
        });


        it("after 1 year", async () => {
            await time.increase(time.duration.years(1));

            const poolUtilisation = fromWei(await pool.totalBorrowed())/fromWei(await pool.totalSupply());

            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(calculateBorrowingRate(poolUtilisation, OFFSET_1_UPDATE), 0.000001);
            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(calculateDepositRate(poolUtilisation, OFFSET_1_UPDATE), 0.000001);

            const poolBalance = fromWei(await mockToken.balanceOf(pool.address));
            const deposits = fromWei(await pool.balanceOf(depositor.address));
            const borrowings = fromWei(await pool.getBorrowed(borrower.address));

            expect(deposits).to.be.lessThanOrEqual(poolBalance + borrowings);
        });
    });
});
