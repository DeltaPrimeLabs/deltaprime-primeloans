import {waffle} from 'hardhat'
import chai from 'chai'
import {solidity} from "ethereum-waffle";

import UtilisationRatesCalculatorArtifact
  from '../../../artifacts/contracts/deprecated/UtilisationRatesCalculator.sol/UtilisationRatesCalculator.json';
import {UtilisationRatesCalculator} from "../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, toWei} from "../../_helpers";

chai.use(solidity);

const {deployContract} = waffle;
const {expect} = chai;

describe('UtilisationRatesCalculator', () => {
  let sut: UtilisationRatesCalculator,
    owner: SignerWithAddress,
    nonOwner: SignerWithAddress;

  beforeEach(async () => {
    [owner, nonOwner] = await getFixedGasSigners(10000000);
    sut = await deployContract(
      owner,
      UtilisationRatesCalculatorArtifact,
      [toWei("0.5"), toWei("0.05")]) as UtilisationRatesCalculator;
  });

  it("should throw if non-owner is trying to set parameters", async () => {
    await expect(sut.connect(nonOwner).setParameters(toWei("999"), toWei("1000")))
      .to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should throw if utilisation factor higher than 1", async () => {
    await expect(sut.setParameters(toWei("1.0001"), toWei("0.5")))
      .to.be.revertedWith("Calculator factor must not be higher than 1.");
  });

  it("should throw if offset higher than 1", async () => {
    await expect(sut.setParameters(toWei("1.0"), toWei("1.0001")))
      .to.be.revertedWith("Calculator offset must not be higher than 1");
  });

  it("should calculate for 0% utilisation", async function () {
    const utilisation = fromWei(await sut.getPoolUtilisation(0, toWei("100")));
    expect(utilisation).to.be.closeTo(0, 0.000001);

    const depositRate = fromWei(await sut.calculateDepositRate(0, toWei("100")));
    expect(depositRate).to.be.closeTo(0, 0.000001);

    const borrowingRate = fromWei(await sut.calculateBorrowingRate(0, toWei("100")));
    expect(borrowingRate).to.be.closeTo(0.05, 0.000001);
  });

  it("should calculate for 10% utilisation", async function () {
    const utilisation = fromWei(await sut.getPoolUtilisation(toWei("10"), toWei("100")));
    expect(utilisation).to.be.closeTo(0.1, 0.000001);

    const depositRate = fromWei(await sut.calculateDepositRate(toWei("10"), toWei("100")));
    expect(depositRate).to.be.closeTo(0.01, 0.000001);

    const borrowingRate = fromWei(await sut.calculateBorrowingRate(toWei("10"), toWei("100")));
    expect(borrowingRate).to.be.closeTo(0.1, 0.000001);
  });

  it("should calculate for 50% utilisation", async function () {
    const utilisation = fromWei(await sut.getPoolUtilisation(toWei("50"), toWei("100")));
    expect(utilisation).to.be.closeTo(0.5, 0.000001);

    const depositRate = fromWei(await sut.calculateDepositRate(toWei("50"), toWei("100")));
    expect(depositRate).to.be.closeTo(0.15, 0.000001);

    const borrowingRate = fromWei(await sut.calculateBorrowingRate(toWei("50"), toWei("100")));
    expect(borrowingRate).to.be.closeTo(0.3, 0.000001);
  });

  it("should calculate for 90% utilisation", async function () {
    const utilisation = fromWei(await sut.getPoolUtilisation(toWei("90"), toWei("100")));
    expect(utilisation).to.be.closeTo(0.9, 0.000001);

    const depositRate = fromWei(await sut.calculateDepositRate(toWei("90"), toWei("100")));
    expect(depositRate).to.be.closeTo(0.45, 0.000001);

    const borrowingRate = fromWei(await sut.calculateBorrowingRate(toWei("90"), toWei("100")));
    expect(borrowingRate).to.be.closeTo(0.5, 0.000001);
  });

  it("should calculate for 100% utilisation", async function () {
    const utilisation = fromWei(await sut.getPoolUtilisation(toWei("100"), toWei("100")));
    expect(utilisation).to.be.closeTo(1, 0.000001);

    const depositRate = fromWei(await sut.calculateDepositRate(toWei("100"), toWei("100")));

    expect(depositRate).to.be.closeTo(0.55, 0.000001);

    const borrowingRate = fromWei(await sut.calculateBorrowingRate(toWei("100"), toWei("100")));
    expect(borrowingRate).to.be.closeTo(0.55, 0.000001);
  });

  it("should calculate for 110% utilisation", async function () {
    const utilisation = fromWei(await sut.getPoolUtilisation(toWei("110"), toWei("100")));
    expect(utilisation).to.be.closeTo(1.1, 0.000001);

    const depositRate = fromWei(await sut.calculateDepositRate(toWei("110"), toWei("100")));

    expect(depositRate).to.be.closeTo(0.55, 0.000001);

    const borrowingRate = fromWei(await sut.calculateBorrowingRate(toWei("110"), toWei("100")));
    expect(borrowingRate).to.be.closeTo(0.55, 0.000001);
  });

});
