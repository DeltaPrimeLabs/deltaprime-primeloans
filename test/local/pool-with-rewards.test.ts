import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

const addresses = require("../../common/addresses/avax/token_addresses.json");
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import PoolRewarderArtifact from '../../artifacts/contracts/PoolRewarder.sol/PoolRewarder.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {
    LinearIndex,
    MockToken,
    OpenBorrowersRegistry,
    Pool,
    PoolRewarder,
    VariableUtilisationRatesCalculator
} from "../../typechain";
import {Contract} from "ethers";

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function transfer(address _to, uint256 _value) public returns (bool success)'
]

const wavaxAbi = [
    'function deposit() public payable',
    ...erc20ABI
]

chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Pool with variable utilisation interest rates and rewards', () => {
    describe('Depositing only (multiple depositors)', () => {
        let pool: Pool,
            rewarder: PoolRewarder,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            depositor1: SignerWithAddress,
            depositor2: SignerWithAddress,
            depositor3: SignerWithAddress,
            poolToken: Contract,
            rewardToken: Contract,
            VariableUtilisationRatesCalculator: VariableUtilisationRatesCalculator;

        before("Deploy Pool & PoolRewarder contracts", async () => {
            [owner, depositor, depositor1, depositor2, depositor3] = await getFixedGasSigners(10000000);
            // Deploy Pool
            pool = (await deployContract(owner, PoolArtifact)) as Pool;

            // Deploy tokens
            poolToken = (await deployContract(owner, MockTokenArtifact, [[depositor1.address, depositor2.address, depositor3.address]])) as MockToken;
            rewardToken = (await deployContract(owner, MockTokenArtifact, [[depositor.address]])) as MockToken;

            // Deploy and initialize rewarder
            rewarder = (await deployContract(owner, PoolRewarderArtifact, [rewardToken.address, pool.address])) as PoolRewarder;

            VariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
            const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            await pool.initialize(
                VariableUtilisationRatesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                poolToken.address,
                rewarder.address
            );
        });

        it("should successfully set the duration target", async () => {
            await rewarder.setRewardsDuration(time.duration.days(360));
        });

        it("should top-up rewarder contract", async () => {
            expect(await rewardToken.balanceOf(rewarder.address)).to.be.equal(0);
            await rewardToken.connect(depositor).transfer(rewarder.address, toWei("500"));
            expect(await rewardToken.balanceOf(rewarder.address)).to.be.equal(toWei("500"));
        });

        it("should fail to set up rewards rewarder contract", async () => {
            expect(await rewarder.rewardRate()).to.be.equal(0);
            await expect(rewarder.notifyRewardAmount(toWei("510"))).to.be.revertedWith("reward amount > balance");
        });

        it("should set up rewards rewarder contract", async () => {
            expect(await rewarder.rewardRate()).to.be.equal(0);
            await rewarder.notifyRewardAmount(toWei("100"));
            expect(await rewarder.rewardRate()).to.be.equal(toWei("100").div(time.duration.days(360)));
        });

        it("should fail to set a new duration during an ongoing one", async () => {
            await expect(rewarder.setRewardsDuration(time.duration.days(1))).to.be.revertedWith("reward duration not finished");
        });

        it("should fail to deposit / withdraw as a non-pool EOA", async () => {
            await expect(rewarder.stakeFor(1, owner.address)).to.be.revertedWith("Unauthorized: onlyPool");
            await expect(rewarder.withdrawFor(1, owner.address)).to.be.revertedWith("Unauthorized: onlyPool");
        });

        it("[360 days] should deposit (depositor1) to pool + depositor2 via transfer and check rewards after some time", async () => {
            expect(await rewardToken.balanceOf(rewarder.address)).to.be.equal(toWei("500"));
            // Deposit to pool DEPOSITOR1 -> +10.0
            await poolToken.connect(depositor1).approve(pool.address, toWei("10.0"));
            await pool.connect(depositor1).deposit(toWei("10.0"));
            expect(await pool.balanceOf(depositor1.address)).to.equal(toWei("10.0"));
            expect(await pool.balanceOf(depositor2.address)).to.equal(0);

            // check rewards
            expect(await pool.connect(depositor1).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor2).checkRewards()).to.be.equal(0);

            // FastForward 180 days ahead (+180 days in total)
            await time.increase(time.duration.days(180));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(50, 1e-4);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.equal(0);

            // FastForward 90 days ahead (+270 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(75, 1e-4);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.equal(0);

            // Transfer deposited funds from borrower1 to borrower2
            await pool.connect(depositor1).transfer(depositor2.address, toWei("5"));
            // FastForward 90 days ahead (360 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(87.5, 1e-4);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(12.5, 1e-4);

            // claim rewards
            let initialRewardTokenBalance = fromWei(await rewardToken.balanceOf(depositor1.address));
            let initialRewardTokenBalance2 = fromWei(await rewardToken.balanceOf(depositor2.address));
            await pool.connect(depositor1).getRewards();
            expect(fromWei(await rewardToken.balanceOf(depositor1.address)) - initialRewardTokenBalance).to.be.closeTo(87.5, 1e-4);
            expect(fromWei(await rewardToken.balanceOf(depositor2.address)) - initialRewardTokenBalance2).to.be.closeTo(0, 1e-4);

            await pool.connect(depositor1).withdraw(toWei("5.0"));
            expect(fromWei(await rewardToken.balanceOf(rewarder.address))).to.be.closeTo(412.5, 1e-4);

            await pool.connect(depositor2).getRewards();
            expect(fromWei(await rewardToken.balanceOf(depositor2.address)) - initialRewardTokenBalance2).to.be.closeTo(12.5, 1e-4);
            expect(fromWei(await rewardToken.balanceOf(rewarder.address))).to.be.closeTo(400, 1e-4);
            await pool.connect(depositor2).withdraw(toWei("5.0"));
        });

        it("should successfully set a new duration target and add rewards", async () => {
            expect(fromWei(await rewardToken.balanceOf(rewarder.address))).to.be.closeTo(400, 1e-4);
            await rewarder.setRewardsDuration(time.duration.days(180));
            await rewarder.notifyRewardAmount(toWei("100"));
        });

        it("[180 days] should deposit (depositor1, 2 & 3) to pool and check rewards after some time", async () => {
            expect(fromWei(await rewardToken.balanceOf(rewarder.address))).to.be.closeTo(400, 1e-4);

            // check rewards
            expect(await pool.connect(depositor1).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor2).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor3).checkRewards()).to.be.equal(0);

            // Deposit to pool DEPOSITOR1 -> +10.0
            await poolToken.connect(depositor1).approve(pool.address, toWei("10.0"));
            await pool.connect(depositor1).deposit(toWei("10.0"));

            // FastForward 90 days ahead (+90 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(50, 1e-4);
            expect(await pool.connect(depositor2).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor3).checkRewards()).to.be.equal(0);

            // Deposit to pool DEPOSITOR2 -> +5.0
            await poolToken.connect(depositor2).approve(pool.address, toWei("5.0"));
            await pool.connect(depositor2).deposit(toWei("5.0"));

            // Deposit to pool DEPOSITOR3 -> +5.0
            await poolToken.connect(depositor3).approve(pool.address, toWei("5.0"));
            await pool.connect(depositor3).deposit(toWei("5.0"));

            // FastForward 45 days ahead (+135 days in total)
            await time.increase(time.duration.days(45));
            // check rewards
            await pool.connect(depositor1).checkRewards();
            await pool.connect(depositor2).checkRewards();
            await pool.connect(depositor3).checkRewards();
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(62.5, 1e-4);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(6.25, 1e-4);
            expect(fromWei(await pool.connect(depositor3).checkRewards())).to.be.closeTo(6.25, 1e-4);

            // FastForward 45 days ahead (+180 days in total)
            await time.increase(time.duration.days(45));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(75, 1e-4);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(12.5, 1e-4);
            expect(fromWei(await pool.connect(depositor3).checkRewards())).to.be.closeTo(12.5, 1e-4);

            // claim rewards
            let initialWavaxBalance1 = fromWei(await rewardToken.balanceOf(depositor1.address));
            let initialWavaxBalance2 = fromWei(await rewardToken.balanceOf(depositor2.address));
            let initialWavaxBalance3 = fromWei(await rewardToken.balanceOf(depositor3.address));
            await pool.connect(depositor1).getRewards();
            await pool.connect(depositor2).getRewards();
            await pool.connect(depositor3).getRewards();
            expect(fromWei(await rewardToken.balanceOf(depositor1.address)) - initialWavaxBalance1).to.be.closeTo(75, 1e-4);
            expect(fromWei(await rewardToken.balanceOf(depositor2.address)) - initialWavaxBalance2).to.be.closeTo(12.5, 1e-4);
            expect(fromWei(await rewardToken.balanceOf(depositor3.address)) - initialWavaxBalance3).to.be.closeTo(12.5, 1e-4);

            expect(fromWei(await rewardToken.balanceOf(rewarder.address))).to.be.closeTo(300, 1e-4);
        });
    });

    describe('Depositing and withdrawing (multiple depositors)', () => {
        let pool: Pool,
            rewarder: PoolRewarder,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            depositor1: SignerWithAddress,
            depositor2: SignerWithAddress,
            depositor3: SignerWithAddress,
            poolToken: Contract,
            rewardToken: Contract,
            VariableUtilisationRatesCalculator: VariableUtilisationRatesCalculator;

        before("Deploy Pool & PoolRewarder contracts", async () => {
            [owner, depositor, depositor1, depositor2, depositor3] = await getFixedGasSigners(10000000);
            // Deploy Pool
            pool = (await deployContract(owner, PoolArtifact)) as Pool;

            // Deploy tokens
            poolToken = (await deployContract(owner, MockTokenArtifact, [[depositor1.address, depositor2.address, depositor3.address]])) as MockToken;
            rewardToken = (await deployContract(owner, MockTokenArtifact, [[depositor.address]])) as MockToken;

            // Deploy and initialize rewarder
            rewarder = (await deployContract(owner, PoolRewarderArtifact, [rewardToken.address, pool.address])) as PoolRewarder;

            VariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
            const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            await pool.initialize(
                VariableUtilisationRatesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                poolToken.address,
                rewarder.address
            );
        });

        it("should top-up rewarder contract", async () => {
            expect(await rewardToken.balanceOf(rewarder.address)).to.be.equal(0);
            await rewardToken.connect(depositor).transfer(rewarder.address, toWei("500"));
            expect(await rewardToken.balanceOf(rewarder.address)).to.be.equal(toWei("500"));
        });

        it("should successfully set the duration target", async () => {
            await rewarder.setRewardsDuration(time.duration.days(360));
        });

        it("should set up rewards rewarder contract", async () => {
            expect(await rewarder.rewardRate()).to.be.equal(0);
            await rewarder.notifyRewardAmount(toWei("100"));
            expect(await rewarder.rewardRate()).to.be.equal(toWei("100").div(time.duration.days(360)));
        });

        it("[360 days] should deposit (depositor1) to pool and check rewards after some time", async () => {
            expect(await rewardToken.balanceOf(rewarder.address)).to.be.equal(toWei("500"));
            // Deposit to pool DEPOSITOR1 -> +10.0
            await poolToken.connect(depositor1).approve(pool.address, toWei("10.0"));
            await pool.connect(depositor1).deposit(toWei("10.0"));

            // check rewards
            expect(await pool.connect(depositor1).checkRewards()).to.be.equal(0);

            // FastForward 180 days ahead (+180 days in total)
            await time.increase(time.duration.days(180));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(50, 1e-4);

            // FastForward 90 days ahead (+270 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(75, 1e-4);

            // Withdraw everything
            let initialWavaxBalance = fromWei(await rewardToken.balanceOf(depositor1.address));
            await pool.connect(depositor1).withdraw(toWei("10.0"));
            await pool.connect(depositor1).getRewards();
            expect(fromWei(await rewardToken.balanceOf(depositor1.address)) - initialWavaxBalance).to.be.closeTo(75, 1e-4);
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.equal(0);


            // FastForward 90 days ahead (360 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.equal(0);

            expect(fromWei(await rewardToken.balanceOf(rewarder.address))).to.be.closeTo(425, 1e-4);
        });

        it("should successfully set a new duration target and add rewards", async () => {
            expect(fromWei(await rewardToken.balanceOf(rewarder.address))).to.be.closeTo(425, 1e-4);
            await rewarder.setRewardsDuration(time.duration.days(180));
            await rewarder.notifyRewardAmount(toWei("100"));
        });

        it("[180 days] should deposit (depositor1, 2 & 3) to pool and check rewards after some time", async () => {
            expect(fromWei(await rewardToken.balanceOf(rewarder.address))).to.be.closeTo(425, 1e-4);

            // check rewards
            expect(await pool.connect(depositor1).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor2).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor3).checkRewards()).to.be.equal(0);

            // Deposit to pool DEPOSITOR1 -> +10.0
            await poolToken.connect(depositor1).approve(pool.address, toWei("10.0"));
            await pool.connect(depositor1).deposit(toWei("10.0"));

            // FastForward 90 days ahead (+90 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(50, 1e-4);
            expect(await pool.connect(depositor2).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor3).checkRewards()).to.be.equal(0);

            // Depositor 1 withdraw all
            await pool.connect(depositor1).withdraw(toWei("10.0"));
            await pool.connect(depositor1).getRewards();

            // Deposit to pool DEPOSITOR2 -> +5.0
            await poolToken.connect(depositor2).approve(pool.address, toWei("5.0"));
            await pool.connect(depositor2).deposit(toWei("5.0"));

            // Deposit to pool DEPOSITOR3 -> +5.0
            await poolToken.connect(depositor3).approve(pool.address, toWei("5.0"));
            await pool.connect(depositor3).deposit(toWei("5.0"));

            // FastForward 45 days ahead (+135 days in total)
            await time.increase(time.duration.days(45));
            // check rewards
            await pool.connect(depositor1).checkRewards();
            await pool.connect(depositor2).checkRewards();
            await pool.connect(depositor3).checkRewards();
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.equal(0);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(12.5, 1e-4);
            expect(fromWei(await pool.connect(depositor3).checkRewards())).to.be.closeTo(12.5, 1e-4);

            // FastForward 45 days ahead (+180 days in total)
            await time.increase(time.duration.days(45));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.equal(0);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(25, 1e-4);
            expect(fromWei(await pool.connect(depositor3).checkRewards())).to.be.closeTo(25, 1e-4);

            // claim rewards
            let initialWavaxBalance1 = fromWei(await rewardToken.balanceOf(depositor1.address));
            let initialWavaxBalance2 = fromWei(await rewardToken.balanceOf(depositor2.address));
            let initialWavaxBalance3 = fromWei(await rewardToken.balanceOf(depositor3.address));
            await pool.connect(depositor1).getRewards();
            await pool.connect(depositor2).getRewards();
            await pool.connect(depositor3).getRewards();
            expect(fromWei(await rewardToken.balanceOf(depositor1.address)) - initialWavaxBalance1).to.be.equal(0);
            expect(fromWei(await rewardToken.balanceOf(depositor2.address)) - initialWavaxBalance2).to.be.closeTo(25, 1e-4);
            expect(fromWei(await rewardToken.balanceOf(depositor3.address)) - initialWavaxBalance3).to.be.closeTo(25, 1e-4);

            expect(fromWei(await rewardToken.balanceOf(rewarder.address))).to.be.closeTo(325, 1e-4);
        });
    });

    describe('Depositing and withdrawing (multiple depositors)', () => {
        let pool: Pool,
            rewarder: PoolRewarder,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            depositor1: SignerWithAddress,
            depositor2: SignerWithAddress,
            depositor3: SignerWithAddress,
            poolToken: Contract,
            rewardToken: Contract,
            VariableUtilisationRatesCalculator: VariableUtilisationRatesCalculator;

        before("Deploy Pool & PoolRewarder contracts", async () => {
            [owner, depositor, depositor1, depositor2, depositor3] = await getFixedGasSigners(10000000);
            // Deploy Pool
            pool = (await deployContract(owner, PoolArtifact)) as Pool;

            // Deploy tokens
            poolToken = (await deployContract(owner, MockTokenArtifact, [[depositor1.address, depositor2.address, depositor3.address]])) as MockToken;
            rewardToken = (await deployContract(owner, MockTokenArtifact, [[depositor.address]])) as MockToken;

            // Deploy and initialize rewarder
            rewarder = (await deployContract(owner, PoolRewarderArtifact, [rewardToken.address, pool.address])) as PoolRewarder;

            VariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
            const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            await pool.initialize(
                VariableUtilisationRatesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                poolToken.address,
                rewarder.address
            );
        });

        it("should top-up rewarder contract", async () => {
            expect(await rewardToken.balanceOf(rewarder.address)).to.be.equal(0);
            await rewardToken.connect(depositor).transfer(rewarder.address, toWei("500"));
            expect(await rewardToken.balanceOf(rewarder.address)).to.be.equal(toWei("500"));
        });

        it("should successfully set the duration target", async () => {
            await rewarder.setRewardsDuration(time.duration.days(360));
        });

        it("should set up rewards rewarder contract", async () => {
            expect(await rewarder.rewardRate()).to.be.equal(0);
            await rewarder.notifyRewardAmount(toWei("100"));
            expect(await rewarder.rewardRate()).to.be.equal(toWei("100").div(time.duration.days(360)));
        });

        it("[360 days] should deposit (depositor1) to pool, borrow, transfer more than initial deposit (because of accumulated interest)", async () => {
            expect(await rewardToken.balanceOf(rewarder.address)).to.be.equal(toWei("500"));
            // Deposit to pool DEPOSITOR1 -> +10.0
            await poolToken.connect(depositor1).approve(pool.address, toWei("10.0"));
            await pool.connect(depositor1).deposit(toWei("10.0"));
            await pool.connect(depositor1).borrow(toWei("7.0"));
            
            expect(await rewarder.balanceOf(depositor1.address)).to.be.equal(toWei("10.0"));
            expect(await rewarder.balanceOf(depositor2.address)).to.be.equal(0);

            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(0, 1e-4);

            // FastForward 180 days ahead (+180 days in total)
            await time.increase(time.duration.days(180));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(50, 1e-4);
            
            await pool.connect(depositor1).transfer(depositor2.address, toWei("10.1"));
            expect(await rewarder.balanceOf(depositor1.address)).to.be.equal(0);
            expect(await rewarder.balanceOf(depositor2.address)).to.be.equal(toWei("10.0"));

            // FastForward 90 days ahead (+270 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(50, 1e-4);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(25, 1e-4);

            await pool.connect(depositor1).transfer(depositor2.address, toWei("0.1"));
            expect(await rewarder.balanceOf(depositor1.address)).to.be.equal(0);
            expect(await rewarder.balanceOf(depositor2.address)).to.be.equal(toWei("10.0"));
        });
    });
});
