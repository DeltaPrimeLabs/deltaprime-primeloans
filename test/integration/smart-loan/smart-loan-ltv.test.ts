import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {getFixedGasSigners, recompileSmartLoanLib} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  MockSmartLoanLogicFacetSetValues,
  MockSmartLoanLogicFacetSetValues__factory
} from "../../../typechain";
import {ethers} from "hardhat";

chai.use(solidity);

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });


  describe('A loan with edge LTV cases', () => {
    let loan: MockSmartLoanLogicFacetSetValues,
        owner: SignerWithAddress;

    before("deploy provider, exchange and pool", async () => {
      [owner] = await getFixedGasSigners(10000000);
      await recompileSmartLoanLib("SmartLoanLib", [0, 1, 3], {'AVAX': ethers.constants.AddressZero}, ethers.constants.AddressZero, ethers.constants.AddressZero, 'lib');
    });

    it("should deploy a smart loan", async () => {
      loan = await (new MockSmartLoanLogicFacetSetValues__factory(owner).deploy());
    });

    it("should check debt equal to 0", async () => {
      await loan.setValue(40000);
      await loan.setDebt(0);
      expect(await loan.getLTV()).to.be.equal(0);
      expect(await loan.isSolvent()).to.be.true;
    });

    it("should check debt greater than 0 and lesser than totalValue", async () => {
      await loan.setValue(50000);
      await loan.setDebt(10000);
      expect(await loan.getLTV()).to.be.equal(250);
      expect(await loan.isSolvent()).to.be.true;
    });

    it("should check debt equal to totalValue", async () => {
      await loan.setValue(40000);
      await loan.setDebt(40000);
      expect(await loan.getLTV()).to.be.equal(5000);
      expect(await loan.isSolvent()).to.be.false;
    });

    it("should check debt greater than totalValue", async () => {
      await loan.setValue(40000);
      await loan.setDebt(40001);
      expect(await loan.getLTV()).to.be.equal(5000);
      expect(await loan.isSolvent()).to.be.false;
    });

    it("should check LTV 4999", async () => {
      await loan.setValue(48001);
      await loan.setDebt(40000);
      expect(await loan.getLTV()).to.be.equal(4999);
      expect(await loan.isSolvent()).to.be.true;
    });

    it("should check LTV 5000", async () => {
      await loan.setValue(48000);
      await loan.setDebt(40000);
      expect(await loan.getLTV()).to.be.equal(5000);
      expect(await loan.isSolvent()).to.be.false;
    });

    it("should check LTV 5001", async () => {
      await loan.setValue(47998);
      await loan.setDebt(40000);
      expect(await loan.getLTV()).to.be.equal(5001);
      expect(await loan.isSolvent()).to.be.false;
    });
  });
});

