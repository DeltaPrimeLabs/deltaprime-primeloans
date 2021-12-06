import {ethers, waffle} from 'hardhat'
import chai from 'chai'
import {solidity} from "ethereum-waffle";

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {CompoundingIndex} from "../../typechain";
import {CompoundingIndex__factory} from "../../typechain";

chai.use(solidity);

const {deployContract} = waffle;
const {expect} = chai;

// TODO: refactor and remove dependencies between tests.
describe('CompoundingIndex',() => {

  let owner: SignerWithAddress;

  async function init(rate: string, owner: SignerWithAddress): Promise<CompoundingIndex> {
    const instance = await (new CompoundingIndex__factory(owner).deploy());
    await instance.setRate(toWei(rate));

    return instance;
  }

  describe('Index without rates', () => {
    let sut: CompoundingIndex;

    before("deploy the Compounding index", async () => {
      [owner] = await getFixedGasSigners(10000000);
      sut = await (new CompoundingIndex__factory(owner).deploy());
    });

    it("should set initial index 1", async () => {
      let start = fromWei(await sut.getIndex());
      expect(start).to.equal(1);
    });

    it("should get user value with the default start", async () => {
      let userValue = fromWei(await sut.getIndexedValue(toWei("1000"), owner.address));
      expect(userValue).to.be.closeTo(1000, 0.001);
    });

  });

  describe('Simple progress', () => {

    let sut: CompoundingIndex;

    before("deploy the Compounding index", async () => {
      [owner] = await getFixedGasSigners(10000000);
      sut = await init("0.05", owner);
    });

    it("should set initial index 1", async () => {
      let start = fromWei(await sut.getIndex());
      expect(start).to.be.closeTo(1, 0.000001);
    });

    it("should increase index 1 year", async () => {
      await time.increase(time.duration.years(1));
      let oneYear = fromWei(await sut.getIndex());
      expect(oneYear).to.be.closeTo(1.051271, 0.000001);
    });

    it("should increase index 2 years", async () => {
      await time.increase(time.duration.years(1));
      let twoYears = fromWei(await sut.getIndex());
      expect(twoYears).to.be.closeTo(1.105171, 0.000001);
    });

    it("should increase index 3 years", async () => {
      await time.increase(time.duration.years(1));
      let threeYears = fromWei(await sut.getIndex());
      expect(threeYears).to.be.closeTo(1.161834, 0.000001);
    });

    it("should increase index 4 years", async () => {
      await time.increase(time.duration.years(1));
      let threeYears = fromWei(await sut.getIndex());
      expect(threeYears).to.be.closeTo(1.221402, 0.000001);
    });
  });

  describe('Progress with rates change', () => {

    let sut: CompoundingIndex;

    before("deploy the Compounding index", async () => {
      sut = await init("0.05", owner);
    });

    it("should set initial index 1", async () => {
      let start = fromWei(await sut.getIndex());
      expect(start).to.be.closeTo(1, 0.000001);
    });

    it("should increase index 1 year on 5%", async () => {
      await time.increase(time.duration.years(1));
      let oneYear = fromWei(await sut.getIndex());
      expect(oneYear).to.be.closeTo(1.051271, 0.000001);
    });

    it("should increase index 2 years on 10%", async () => {
      await sut.setRate(toWei("0.10"));
      await time.increase(time.duration.years(1));
      let twoYears = fromWei(await sut.getIndex());
      expect(twoYears).to.be.closeTo(1.161834, 0.000001);
    });

    it("should increase index 3 years", async () => {
      await sut.setRate(toWei("0.05"));
      await time.increase(time.duration.years(1));
      let threeYears = fromWei(await sut.getIndex());
      expect(threeYears).to.be.closeTo(1.221402, 0.000001);
    });
  });

  describe('Single user without snapshots', function () {

    let sut: CompoundingIndex;

    before("deploy the Compounding index", async () => {
      sut = await init("0.05", owner);
    });

    it("should set initial index 1", async () => {
      let start = fromWei(await sut.getIndex());
      expect(start).to.be.closeTo(1, 0.000001);
    });

    it("should increase index 1 year on 5%", async () => {
      await time.increase(time.duration.years(1));
      let oneYear = fromWei(await sut.getIndex());
      expect(oneYear).to.be.closeTo(1.051, 0.001);
    });

    it("should get user value with the default start", async () => {
      let userValue = fromWei(await sut.getIndexedValue(toWei("1000"), owner.address));
      expect(userValue).to.be.closeTo(1051.271, 0.001);
    });

    it("should increase index 2 years", async () => {
      await time.increase(time.duration.years(1));
      let userValue = fromWei(await sut.getIndexedValue(toWei("1000"), owner.address));
      expect(userValue).to.be.closeTo(1105.170, 0.001);
    });

    it("should increase index 3 years", async () => {
      await time.increase(time.duration.years(1));
      let userValue = fromWei(await sut.getIndexedValue(toWei("1000"), owner.address));
      expect(userValue).to.be.closeTo(1161.834, 0.001);
    });
  });

  describe('Single user with snapshots', function () {

    let sut: CompoundingIndex;

    before("deploy the Compounding index", async function () {
      sut = sut = await init("0.05", owner);
    });

    it("should set initial index 1", async function () {
      let start = fromWei(await sut.getIndex());
      expect(start).to.be.closeTo(1, 0.001);
    });

    it("should increase index 1 year on 5%", async function () {
      await time.increase(time.duration.years(1));
      let oneYear = fromWei(await sut.getIndex());
      expect(oneYear).to.be.closeTo(1.051, 0.001);
    });

    it("should set user snapshot", async function () {
      await sut.updateUser(owner.address);
    });

    it("should get user value with the default start", async function () {
      let userValue = fromWei(await sut.getIndexedValue(toWei("1000"), owner.address));
      expect(userValue).to.be.closeTo(1000.000, 0.001);
    });

    it("should increase user value 1 year from snapshot", async function () {
      await time.increase(time.duration.years(1));
      let userValue = fromWei(await sut.getIndexedValue(toWei("1000"), owner.address));
      expect(userValue).to.be.closeTo(1051.271, 0.001);
    });

    it("should increase index 2 years after the snapshot", async function () {
      await time.increase(time.duration.years(1));
      let userValue = fromWei(await sut.getIndexedValue(toWei("1000"), owner.address));
      expect(userValue).to.be.closeTo(1105.170, 0.001);
    });
  });
});

