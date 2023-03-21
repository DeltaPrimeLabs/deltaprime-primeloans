import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import VestingDistributorArtifact from "../../artifacts/contracts/VestingDistributor.sol/VestingDistributor.json";
import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {
    LinearIndex,
    MockToken,
    MockVariableUtilisationRatesCalculator,
    OpenBorrowersRegistry,
    Pool,
    VestingDistributor
} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;
const ZERO = ethers.constants.AddressZero;

describe('Pool with variable utilisation interest rates', () => {
    describe('Single borrowing with interest rates', () => {
        let sut: Pool,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            depositorVested: SignerWithAddress,
            mockToken: Contract,
            vestingDistributor: Contract,
            MockVariableUtilisationRatesCalculator: MockVariableUtilisationRatesCalculator;

        before("Deploy Pool contract", async () => {
            [owner, depositor, depositorVested] = await getFixedGasSigners(10000000);
            sut = (await deployContract(owner, PoolArtifact)) as Pool;

            mockToken = (await deployContract(owner, MockTokenArtifact, [[depositor.address, depositorVested.address, owner.address]])) as MockToken;

            MockVariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;

            await MockVariableUtilisationRatesCalculator.setSpread(toWei("0.2"));

            const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(sut.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(sut.address);

            await sut.initialize(
                MockVariableUtilisationRatesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                mockToken.address,
                ZERO,
                0
            );

            vestingDistributor = (await deployContract(owner, VestingDistributorArtifact, [sut.address])) as VestingDistributor;

            await sut.setVestingDistributor(vestingDistributor.address);

            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));

            await mockToken.connect(depositorVested).approve(sut.address, toWei("1.0"));
            await sut.connect(depositorVested).deposit(toWei("1.0"));
        });

        it("should borrow", async () => {
            await sut.borrow(toWei("1.0"));
            expect(await mockToken.balanceOf(sut.address)).to.be.equal(toWei("1", "ether"));

            let borrowed = fromWei(await sut.getBorrowed(owner.address));
            expect(borrowed).to.be.closeTo(1.000000, 0.000001);
        });

        it("should keep the loan for 6 hours", async () => {
            await time.increase(time.duration.hours(6));

            let borrowed = fromWei(await sut.getBorrowed(owner.address));
            expect(borrowed).to.be.closeTo(1.00002054, 0.0000001);

            let deposited1 = fromWei(await sut.balanceOf(depositor.address));
            let deposited2 = fromWei(await sut.balanceOf(depositorVested.address));

            expect(deposited1).to.be.closeTo(1.000008219, 0.0000001);
            expect(deposited2).to.be.closeTo(1.000008219, 0.0000001);
        });

        it("should vest for the second depositor", async () => {
            let deposited2 = await sut.balanceOf(depositorVested.address);

            await vestingDistributor.connect(depositorVested).startVesting(deposited2, 1_728_000); //20 days
        });

        it("should distribute 50% of surplus as rewards after a year", async () => {
            await time.increase(time.duration.years(1));

            let poolBalance = fromWei(await mockToken.balanceOf(sut.address));
            let totalBorrowed = fromWei(await sut.totalBorrowed());
            let totalSupply = fromWei(await sut.totalSupply());

            const currentSurplus = poolBalance + totalBorrowed - totalSupply;

            const surplusWei = toWei(currentSurplus.toFixed(18));

            //owner recovers surplus
            await sut.connect(owner).recoverSurplus(surplusWei, owner.address);

            const vestingRewards = currentSurplus / 2;
            const vestingRewardsWei = toWei(vestingRewards.toFixed(18))

            await mockToken.connect(owner).approve(sut.address, vestingRewardsWei);
            await sut.connect(owner).deposit(vestingRewardsWei);

            await sut.connect(owner).transfer(vestingDistributor.address, vestingRewardsWei);

            await vestingDistributor.connect(owner).distributeRewards();
        });

        it("should check rewards for depositors", async () => {

            let deposited1 = fromWei(await sut.balanceOf(depositor.address));
            let deposited2 = fromWei(await sut.balanceOf(depositorVested.address));

            expect(deposited1).to.be.closeTo( 1.01200821, 0.0000001);
            expect(deposited2).to.be.closeTo( 1.015010276, 0.0000001);
        });
    });
});
