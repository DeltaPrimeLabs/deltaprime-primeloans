import {ethers, waffle} from "hardhat"
import chai, {expect} from "chai"
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact from "../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json";
import CompoundingIndexArtifact from "../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json";
import PoolArtifact from "../../artifacts/contracts/Pool.sol/Pool.json";
import OpenBorrowersRegistryArtifact
  from "../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, time, toWei, getFixedGasSigners} from "../_helpers";
import {VariableUtilisationRatesCalculator, OpenBorrowersRegistry, Pool, CompoundingIndex} from "../../typechain";

chai.use(solidity);

const {deployContract} = waffle;

describe("Pool ERC20 token functions", () => {
  let sut: Pool,
    owner: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    user3: SignerWithAddress,
    user4: SignerWithAddress,
    user5: SignerWithAddress,
    user6: SignerWithAddress,
    VariableUtilisationRatesCalculator: VariableUtilisationRatesCalculator;

  // shortcut to Pool.balanceOf with conversion to ethers.
  async function balanceOf(user: SignerWithAddress): Promise<number> {
    return fromWei(await sut.balanceOf(user.address));
  }

  beforeEach(async () => {
    [owner, user1, user2, user3, user4, user5, user6] = await getFixedGasSigners(10000000);
    sut = (await deployContract(owner, PoolArtifact)) as Pool;

    let VariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
    let borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
    const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [sut.address])) as CompoundingIndex;
    const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [sut.address])) as CompoundingIndex;

    await sut.initialize(
        VariableUtilisationRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
    );
  });

  describe("transfer", () => {

    it("should revert if not enough balance", async () => {
      await sut.connect(user1).deposit({value: toWei("1.0")});

      await expect(sut.connect(user1).transfer(user2.address, toWei("1.1")))
        .to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("should accumulate user1 interest prior to transferring the funds", async () => {
      // given
      await sut.connect(user1).deposit({value: toWei("1.0")});
      await sut.connect(user1).borrow(toWei("0.7"));
      await time.increase(time.duration.years(1));

      // note: after accumulating interest user1 should be able to transfer
      // more funds than originally deposited
      // when
      await sut.connect(user1).transfer(user2.address, toWei("1.04"));

      // then
      expect(await balanceOf(user2)).to.be.equal(1.04);
      expect(await balanceOf(user1)).to.be.closeTo(0.058340059, 0.000001);
    });

    it("should accumulate user2 interest prior to transferring the funds", async () => {
      // given
      await sut.connect(user1).deposit({value: toWei("1.0")});
      await sut.connect(user2).deposit({value: toWei("2.0")});
      await sut.connect(user3).borrow(toWei("2.0"));
      await time.increase(time.duration.years(1));

      // when
      await sut.connect(user1).transfer(user2.address, toWei("1.05"));

      // then
      expect(await balanceOf(user1)).to.be.closeTo(0.04053311, 0.000001);
      expect(await balanceOf(user2)).to.be.closeTo(3.2310662, 0.000001);
    });

  });

  describe("approve", () => {
    it("should revert upon setting an allowance for a zero address", async () => {
      await expect(sut.connect(user1).approve(ethers.constants.AddressZero, toWei("1.05"))).to.be.revertedWith("Allowance spender cannot be a zero address");
    });

    it("should properly assign amount to different spenders within one owner", async () => {
      await sut.connect(user1).deposit({value: toWei("5.0")});


      await sut.connect(user1).approve(user2.address, toWei("1.05"));
      await sut.connect(user1).approve(user3.address, toWei("2.03"));
      await sut.connect(user1).approve(user4.address, toWei("1.27"));

      // then
      expect(fromWei(await sut.allowance(user1.address, user2.address)))
        .to.be.equal(1.05);
      expect(fromWei(await sut.allowance(user1.address, user3.address)))
        .to.be.equal(2.03);
      expect(fromWei(await sut.allowance(user1.address, user4.address)))
        .to.be.equal(1.27);
    });

    it("should properly assign amount to different spenders for different owners", async () => {
      // given
      await sut.connect(user1).deposit({value: toWei("5.0")});
      await sut.connect(user2).deposit({value: toWei("3.0")});

      // when
      await sut.connect(user1).approve(user2.address, toWei("2.33"));
      await sut.connect(user1).approve(user3.address, toWei("1.89"));
      await sut.connect(user2).approve(user3.address, toWei("1.89"));
      await sut.connect(user2).approve(user4.address, toWei("2.33"));

      // then
      expect(fromWei(await sut.allowance(user1.address, user2.address)))
        .to.be.equal(2.33);
      expect(fromWei(await sut.allowance(user1.address, user3.address)))
        .to.be.equal(1.89);
      expect(fromWei(await sut.allowance(user1.address, user4.address)))
        .to.be.equal(0);

      expect(fromWei(await sut.allowance(user2.address, user2.address)))
        .to.be.equal(0);
      expect(fromWei(await sut.allowance(user2.address, user3.address)))
        .to.be.equal(1.89);
      expect(fromWei(await sut.allowance(user2.address, user4.address)))
        .to.be.equal(2.33);
    });
  })

  describe("increaseAllowance", () => {
    it("should revert upon increasing an allowance for a zero address", async () => {
      await expect(sut.connect(user1).increaseAllowance(ethers.constants.AddressZero, toWei("1"))).to.be.revertedWith("Allowance spender cannot be a zero address");
    });

    it("should increase an allowance", async () => {
      await sut.connect(user1).increaseAllowance(user2.address, toWei("1"));
      await sut.connect(user1).increaseAllowance(user2.address, toWei("3"));
      expect(await sut.allowance(user1.address, user2.address)).to.be.equal(toWei("4"))
    });
  });

  describe("decreaseAllowance", () => {
    it("should revert upon decreasing an allowance for a zero address", async () => {
      await expect(sut.connect(user1).decreaseAllowance(ethers.constants.AddressZero, toWei("1"))).to.be.revertedWith("Allowance spender cannot be a zero address");
    });

    it("should decrease an allowance", async () => {
      await sut.connect(user1).approve(user2.address, toWei("6"));
      await sut.connect(user1).decreaseAllowance(user2.address, toWei("1"));
      await sut.connect(user1).decreaseAllowance(user2.address, toWei("2"));
      expect(await sut.allowance(user1.address, user2.address)).to.be.equal(toWei("3"))
    });

    it("should revert upon decreasing an allowance for below the current allowance level", async () => {
      await expect(sut.connect(user1).decreaseAllowance(user2.address, toWei("100"))).to.be.revertedWith("Current allowance is smaller than the subtractedValue");
    });

  });

  describe("transferFrom", () => {
    it("should revert if amount is higher than user1 balance", async () => {
      await sut.connect(user1).deposit({value: toWei("2.0")});
      await sut.connect(user1).approve(user2.address, toWei("2.0"));
      await sut.connect(user1).withdraw(toWei("1.0"));

      await expect(sut.connect(user2).transferFrom(user1.address, user2.address, toWei("1.01")))
        .to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("should revert if caller's allowance for user1's tokens is too low", async () => {
      await sut.connect(user1).deposit({value: toWei("1.0")});
      await sut.connect(user1).approve(user2.address, toWei("0.5"));

      await expect(sut.connect(user2).transferFrom(user1.address, user2.address, toWei("0.55")))
        .to.be.revertedWith("Not enough tokens allowed to transfer required amount");
    });

    it("should decrease allowance by the transfer amount", async () => {
      await sut.connect(user1).deposit({value: toWei("1.0")});
      await sut.connect(user1).approve(user5.address, toWei("0.5"));

      await sut.connect(user5).transferFrom(user1.address, user3.address, toWei("0.4"));
      expect(fromWei(await sut.allowance(user1.address, user5.address)))
        .to.be.equal(0.1);
    });

    it("should decrease balance of the user1 after transfer from user1 to user3", async () => {
      await sut.connect(user1).deposit({value: toWei("2.0")});
      await sut.connect(user1).approve(user5.address, toWei("1.5"));

      await sut.connect(user5).transferFrom(user1.address, user3.address, toWei("1.2"));
      expect(await balanceOf(user1)).to.be.closeTo(0.8, 0.000001);
    });

    it("should not decrease balance of the msg.user5", async () => {
      await sut.connect(user1).deposit({value: toWei("3.9")});
      await sut.connect(user5).deposit({value: toWei("5.2")});
      await sut.connect(user3).deposit({value: toWei("4.0")});
      await sut.connect(user1).approve(user5.address, toWei("2.0"));

      await sut.connect(user5).transferFrom(user1.address, user3.address, toWei("0.89"));

      expect(await balanceOf(user5)).to.be.closeTo(5.2, 0.00001);
    });

    it("should increase balance of the user3 after transfer from user1", async () => {
      await sut.connect(user1).deposit({value: toWei("3.9")});
      await sut.connect(user3).deposit({value: toWei("1.0")});
      await sut.connect(user1).approve(user5.address, toWei("0.9"));

      await sut.connect(user5).transferFrom(user1.address, user3.address, toWei("0.89"));
      expect(await balanceOf(user3)).to.be.closeTo(1.89, 0.000001);
    });

    it("should accumulate interest of the user1 and user3", async () => {
      await sut.connect(user1).deposit({value: toWei("3.9")});
      await sut.connect(user3).deposit({value: toWei("1.0")});
      await sut.connect(user1).approve(user5.address, toWei("3.9"));

      await time.increase(time.duration.years(5));
      await sut.connect(user5).transferFrom(user1.address, user3.address, toWei("1.0"));

      expect(await balanceOf(user1)).to.be.closeTo(2.9, 0.000001);
      expect(await balanceOf(user3)).to.be.closeTo(2, 0.000001);
    });
  });

  describe("totalSupply with multiple depositors", () => {
    it("should properly sum total tokens supply - minting", async () => {
      await sut.connect(user1).deposit({value: toWei("4.06")});
      await sut.connect(user2).deposit({value: toWei("3.1")});
      await sut.connect(user3).deposit({value: toWei("12.14")});
      await sut.connect(user4).deposit({value: toWei("4.354")});
      await sut.connect(user5).deposit({value: toWei("12.64")});

      let balanceOfUser1 = await balanceOf(user1);
      let balanceOfUser2 = await balanceOf(user2);
      let balanceOfUser3 = await balanceOf(user3);
      let balanceOfUser4 = await balanceOf(user4);
      let balanceOfUser5 = await balanceOf(user5);

      let sumOfBalances = balanceOfUser1 + balanceOfUser2 + balanceOfUser3 + balanceOfUser4 + balanceOfUser5;

      expect(fromWei(await sut.totalSupply())).to.be.equal(36.294);
      expect(fromWei(await sut.totalSupply())).to.be.closeTo(sumOfBalances, 0.000001);
    });

    it("should properly sum total tokens supply - minting and burning", async () => {
      await sut.connect(user1).deposit({value: toWei("4.06")});
      await sut.connect(user2).deposit({value: toWei("3.1")});
      await sut.connect(user1).withdraw(toWei("2.0"));
      await sut.connect(user2).withdraw(toWei("1.5"));

      let balanceOfUser1 = await balanceOf(user1);
      let balanceOfUser2 = await balanceOf(user2);

      expect(fromWei(await sut.totalSupply())).to.be.closeTo(3.660000, 0.000001);
      expect(fromWei(await sut.totalSupply())).to.be.closeTo(balanceOfUser1 + balanceOfUser2, 0.000001);
    });

    it("should properly sum total tokens supply with accumulated interest - minting", async () => {
      await sut.connect(user1).deposit({value: toWei("4.06")});
      await sut.connect(user2).deposit({value: toWei("3.1")});
      await sut.connect(user3).deposit({value: toWei("12.14")});
      await sut.connect(user4).deposit({value: toWei("4.354")});
      await sut.connect(user5).deposit({value: toWei("12.64")});
      await sut.connect(user6).borrow(toWei("20"));

      await time.increase(time.duration.years(1));

      let balanceOfUser1 = await balanceOf(user1);
      let balanceOfUser2 = await balanceOf(user2);
      let balanceOfUser3 = await balanceOf(user3);
      let balanceOfUser4 = await balanceOf(user4);
      let balanceOfUser5 = await balanceOf(user5);

      expect(balanceOfUser1).to.be.closeTo( 4.3283013, 0.000001);
      expect(balanceOfUser2).to.be.closeTo( 3.304860634, 0.000001);
      expect(balanceOfUser3).to.be.closeTo( 12.94226067, 0.000001);
      expect(balanceOfUser4).to.be.closeTo( 4.64173006, 0.000001);
      expect(balanceOfUser5).to.be.closeTo( 13.475302716, 0.000001);

      let sumOfBalances = balanceOfUser1 + balanceOfUser2 + balanceOfUser3 + balanceOfUser4 + balanceOfUser5;

      expect(fromWei(await sut.totalSupply())).to.be.closeTo(sumOfBalances, 0.000001);
    });

    it("should properly sum total tokens supply with accumulated interest - burning", async () => {
      await sut.connect(user1).deposit({value: toWei("4.06")});
      await sut.connect(user2).deposit({value: toWei("3.1")});
      await sut.connect(user3).borrow(toWei("2"));

      await time.increase(time.duration.years(1));

      expect(await balanceOf(user1)).to.be.closeTo( 4.15583120, 0.000001);
      expect(await balanceOf(user2)).to.be.closeTo( 3.173171609 , 0.000001);

      await sut.connect(user1).withdraw(toWei("2.06"));
      await sut.connect(user2).withdraw(toWei("1.1"));

      expect(await balanceOf(user1)).to.be.closeTo( 2.09583121113, 0.000001);
      expect(await balanceOf(user2)).to.be.closeTo( 2.073171616, 0.000001);
    });

    it("should properly sum total tokens supply with accumulated interest - minting, burning and borrowing", async () => {
      await sut.connect(user1).deposit({value: toWei("3.06")});
      await sut.connect(user2).deposit({value: toWei("2.1")});
      await sut.connect(user3).borrow(toWei("1"));

      await time.increase(time.duration.years(1));

      expect(await balanceOf(user1)).to.be.closeTo( 3.103752238, 0.000001);
      expect(await balanceOf(user2)).to.be.closeTo( 2.130026046, 0.000001);
      await sut.connect(user1).withdraw(toWei("2.06"));
      await sut.connect(user2).withdraw(toWei("1.1"));

      expect(await balanceOf(user1)).to.be.closeTo( 1.0437522411, 0.000001);
      expect(await balanceOf(user2)).to.be.closeTo( 1.030026049, 0.000001);

      await time.increase(time.duration.years(1));

      let balanceOfUser1 = await balanceOf(user1);
      let balanceOfUser2 = await balanceOf(user2);

      expect(balanceOfUser1).to.be.closeTo( 1.106355702, 0.000001);
      expect(balanceOfUser2).to.be.closeTo( 1.0918062236, 0.000001);

      let sumOfBalances = balanceOfUser1 + balanceOfUser2;

      expect(fromWei(await sut.totalSupply())).to.be.closeTo(sumOfBalances, 0.000001);

      await sut.connect(user3).borrow(toWei("0.87"));

      await time.increase(time.duration.years(1));

      balanceOfUser1 = await balanceOf(user1);
      balanceOfUser2 = await balanceOf(user2);

      expect(balanceOfUser1).to.be.closeTo( 1.9107890715, 0.000001);
      expect(balanceOfUser2).to.be.closeTo( 1.885660606, 0.000001);

      sumOfBalances = balanceOfUser1 + balanceOfUser2;

      expect(fromWei(await sut.totalSupply())).to.be.closeTo(sumOfBalances, 0.000001);

      await sut.connect(user3).repay({value: toWei("0.22")});

      await time.increase(time.duration.years(1));

      balanceOfUser1 = await balanceOf(user1);
      balanceOfUser2 = await balanceOf(user2);

      expect(balanceOfUser1).to.be.closeTo( 3.019594815, 0.000001);
      expect(balanceOfUser2).to.be.closeTo( 2.979884727, 0.000001);

      sumOfBalances = balanceOfUser1 + balanceOfUser2;

      expect(fromWei(await sut.totalSupply())).to.be.closeTo(sumOfBalances, 0.000001);
    });
  });
});
