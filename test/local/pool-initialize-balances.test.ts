import {ethers, waffle} from "hardhat"
import chai, {expect} from "chai"
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorZeroRateArtifact
    from "../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculatorZeroRate.sol/MockVariableUtilisationRatesCalculatorZeroRate.json";
import VariableUtilisationRatesCalculatorNormalRateArtifact
    from "../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json";
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import PoolArtifact from "../../artifacts/contracts/Pool.sol/Pool.json";
import OpenBorrowersRegistryArtifact
    from "../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {customError, fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {LinearIndex, MockToken, OpenBorrowersRegistry, Pool, MockVariableUtilisationRatesCalculator} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;
const ZERO = ethers.constants.AddressZero;

describe("Pool ERC20 token functions", () => {
    let sut: Pool,
        owner: SignerWithAddress,
        user1: SignerWithAddress,
        user2: SignerWithAddress,
        user3: SignerWithAddress,
        user4: SignerWithAddress,
        user5: SignerWithAddress,
        user6: SignerWithAddress,
        mockToken: Contract,
        mockVariableUtilisationRatesCalculatorZeroRate: MockVariableUtilisationRatesCalculator,
        mockVariableUtilisationRatesCalculatorNormalRate: MockVariableUtilisationRatesCalculator;

    // shortcut to Pool.balanceOf with conversion to ethers.
    async function balanceOf(user: SignerWithAddress): Promise<number> {
        return fromWei(await sut.balanceOf(user.address));
    }

    async function getBorrowed(user: SignerWithAddress): Promise<number> {
        return fromWei(await sut.getBorrowed(user.address));
    }

    before(async () => {
        [owner, user1, user2, user3, user4, user5, user6] = await getFixedGasSigners(10000000);
        sut = (await deployContract(owner, PoolArtifact)) as Pool;

        mockToken = (await deployContract(owner, MockTokenArtifact, [[user1.address, user2.address, user3.address, user4.address, user5.address, user6.address]])) as MockToken;

        mockVariableUtilisationRatesCalculatorZeroRate = (await deployContract(owner, VariableUtilisationRatesCalculatorZeroRateArtifact)) as MockVariableUtilisationRatesCalculator;
        mockVariableUtilisationRatesCalculatorNormalRate = (await deployContract(owner, VariableUtilisationRatesCalculatorNormalRateArtifact)) as MockVariableUtilisationRatesCalculator;
        let borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
        const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await depositIndex.initialize(sut.address);
        const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await borrowingIndex.initialize(sut.address);

        await sut.initialize(
            mockVariableUtilisationRatesCalculatorZeroRate.address,
            borrowersRegistry.address,
            depositIndex.address,
            borrowingIndex.address,
            mockToken.address,
            ZERO,
            0
        );
    });

    describe("Initialize deposits", () => {
        it("should revert on non-owner call to initializeDeposits()", async () => {
            await expect(sut.connect(user1).initializeDeposits([], [])).to.be.revertedWith("Ownable: caller is not the owner")
        });

        it("should revert if deposits and users arrays have different lengths", async () => {
            await expect(sut.connect(owner).initializeDeposits([user1.address], [])).to.be.revertedWith("Arrays length mismatch");
        });

        it("should revert on initializing same depositor twice", async () => {
            await expect(sut.connect(owner).initializeDeposits(
                [user1.address, user1.address],
                [toWei("4.06"), toWei("3.1")]
            )).to.be.revertedWith("Depositor already initialized");
        });

        it("should check initial deposit balances, initialize deposits, check balances again", async () => {
            expect(await balanceOf(user1)).to.be.equal(0);
            expect(await balanceOf(user2)).to.be.equal(0);
            expect(await balanceOf(user3)).to.be.equal(0);
            expect(await balanceOf(user4)).to.be.equal(0);
            expect(await balanceOf(user5)).to.be.equal(0);
            expect(await balanceOf(user6)).to.be.equal(0);
            expect(fromWei(await sut.totalSupply())).to.be.equal(0);

            await sut.connect(owner).initializeDeposits(
                [user1.address, user2.address, user3.address, user4.address, user5.address, user6.address],
                [toWei("4.06"), toWei("3.1"), toWei("12.14"), toWei("4.354"), toWei("12.64"), toWei("20")]
            );

            expect(await balanceOf(user1)).to.be.equal(4.06);
            expect(await balanceOf(user2)).to.be.equal(3.1);
            expect(await balanceOf(user3)).to.be.equal(12.14);
            expect(await balanceOf(user4)).to.be.equal(4.354);
            expect(await balanceOf(user5)).to.be.equal(12.64);
            expect(await balanceOf(user6)).to.be.equal(20);
            expect(fromWei(await sut.totalSupply())).to.be.equal(56.294);
        });

        it("should wait 1 year, check if balances did not change (rate 0)", async () => {
            await time.increase(time.duration.years(1));

            expect(await balanceOf(user1)).to.be.equal(4.06);
            expect(await balanceOf(user2)).to.be.equal(3.1);
            expect(await balanceOf(user3)).to.be.equal(12.14);
            expect(await balanceOf(user4)).to.be.equal(4.354);
            expect(await balanceOf(user5)).to.be.equal(12.64);
            expect(await balanceOf(user6)).to.be.equal(20);
            expect(fromWei(await sut.totalSupply())).to.be.equal(56.294);
        });

        it("should revert on non-owner call to initializeBorrows()", async () => {
            await expect(sut.connect(user1).initializeBorrows([], [])).to.be.revertedWith("Ownable: caller is not the owner")
        });

        it("should revert if borrows and users arrays have different lengths", async () => {
            await expect(sut.connect(owner).initializeBorrows([user1.address], [])).to.be.revertedWith("Arrays length mismatch");
        });

        it("should revert on initializing same borrower twice", async () => {
            await expect(sut.connect(owner).initializeBorrows(
                [user1.address, user1.address],
                [toWei("4.06"), toWei("3.1")]
            )).to.be.revertedWith("Borrower already initialized");
        });

        it("should check initial borrow balances, initialize borrows, check balances again", async () => {
            expect(await getBorrowed(user1)).to.be.equal(0);
            expect(await getBorrowed(user2)).to.be.equal(0);
            expect(await getBorrowed(user3)).to.be.equal(0);
            expect(await getBorrowed(user4)).to.be.equal(0);
            expect(await getBorrowed(user5)).to.be.equal(0);
            expect(await getBorrowed(user6)).to.be.equal(0);
            expect(fromWei(await sut.totalBorrowed())).to.be.equal(0);

            await sut.connect(owner).initializeBorrows(
                [user1.address, user2.address, user3.address, user4.address, user5.address, user6.address],
                [toWei("4.06"), toWei("3.1"), toWei("12.14"), toWei("4.354"), toWei("12.64"), toWei("20")],
            );

            expect(await getBorrowed(user1)).to.be.equal(4.06);
            expect(await getBorrowed(user2)).to.be.equal(3.1);
            expect(await getBorrowed(user3)).to.be.equal(12.14);
            expect(await getBorrowed(user4)).to.be.equal(4.354);
            expect(await getBorrowed(user5)).to.be.equal(12.64);
            expect(await getBorrowed(user6)).to.be.equal(20);
            expect(fromWei(await sut.totalBorrowed())).to.be.equal(56.294);
        });

        it("should wait 1 year, check if balances did not change (rate 0)", async () => {
            await time.increase(time.duration.years(1));

            expect(await getBorrowed(user1)).to.be.equal(4.06);
            expect(await getBorrowed(user2)).to.be.equal(3.1);
            expect(await getBorrowed(user3)).to.be.equal(12.14);
            expect(await getBorrowed(user4)).to.be.equal(4.354);
            expect(await getBorrowed(user5)).to.be.equal(12.64);
            expect(await getBorrowed(user6)).to.be.equal(20);
            expect(fromWei(await sut.totalBorrowed())).to.be.equal(56.294);
        });


        it("should check deposits/borrows, increase time by 1 year, check again if balances are equal, set rates calculator to normal one (75% max rate), increase time by 1 year, check if borrows increased by 75%, and deposits by 60% (max rate - spread)", async () => {
            expect(await balanceOf(user1)).to.be.equal(4.06);
            expect(await balanceOf(user2)).to.be.equal(3.1);
            expect(await balanceOf(user3)).to.be.equal(12.14);
            expect(await balanceOf(user4)).to.be.equal(4.354);
            expect(await balanceOf(user5)).to.be.equal(12.64);
            expect(await balanceOf(user6)).to.be.equal(20);
            expect(fromWei(await sut.totalSupply())).to.be.equal(56.294);

            expect(await getBorrowed(user1)).to.be.equal(4.06);
            expect(await getBorrowed(user2)).to.be.equal(3.1);
            expect(await getBorrowed(user3)).to.be.equal(12.14);
            expect(await getBorrowed(user4)).to.be.equal(4.354);
            expect(await getBorrowed(user5)).to.be.equal(12.64);
            expect(await getBorrowed(user6)).to.be.equal(20);
            expect(fromWei(await sut.totalBorrowed())).to.be.equal(56.294);

            await time.increase(time.duration.years(1));

            expect(await balanceOf(user1)).to.be.equal(4.06);
            expect(await balanceOf(user2)).to.be.equal(3.1);
            expect(await balanceOf(user3)).to.be.equal(12.14);
            expect(await balanceOf(user4)).to.be.equal(4.354);
            expect(await balanceOf(user5)).to.be.equal(12.64);
            expect(await balanceOf(user6)).to.be.equal(20);
            expect(fromWei(await sut.totalSupply())).to.be.equal(56.294);

            expect(await getBorrowed(user1)).to.be.equal(4.06);
            expect(await getBorrowed(user2)).to.be.equal(3.1);
            expect(await getBorrowed(user3)).to.be.equal(12.14);
            expect(await getBorrowed(user4)).to.be.equal(4.354);
            expect(await getBorrowed(user5)).to.be.equal(12.64);
            expect(await getBorrowed(user6)).to.be.equal(20);
            expect(fromWei(await sut.totalBorrowed())).to.be.equal(56.294);

            await sut.connect(owner).setRatesCalculator(mockVariableUtilisationRatesCalculatorNormalRate.address);

            await time.increase(time.duration.years(1));

            expect(await balanceOf(user1)).to.be.closeTo(4.06 * 1.6, 1e-5);
            expect(await balanceOf(user2)).to.be.closeTo(3.1 * 1.6, 1e-5);
            expect(await balanceOf(user3)).to.be.closeTo(12.14 * 1.6, 1e-5);
            expect(await balanceOf(user4)).to.be.closeTo(4.354 * 1.6, 1e-5);
            expect(await balanceOf(user5)).to.be.closeTo(12.64 * 1.6, 1e-5);
            expect(await balanceOf(user6)).to.be.closeTo(20 * 1.6, 1e-5);
            expect(fromWei(await sut.totalSupply())).to.be.closeTo(56.294 * 1.6, 1e-5);

            expect(await getBorrowed(user1)).to.be.closeTo(4.06 * 1.75, 1e-5);
            expect(await getBorrowed(user2)).to.be.closeTo(3.1 * 1.75, 1e-5);
            expect(await getBorrowed(user3)).to.be.closeTo(12.14 * 1.75, 1e-5);
            expect(await getBorrowed(user4)).to.be.closeTo(4.354 * 1.75, 1e-5);
            expect(await getBorrowed(user5)).to.be.closeTo(12.64 * 1.75, 1e-5);
            expect(await getBorrowed(user6)).to.be.closeTo(20 * 1.75, 1e-5);
            expect(fromWei(await sut.totalBorrowed())).to.be.closeTo(56.294 * 1.75, 1e-5);
        });
    });
});
