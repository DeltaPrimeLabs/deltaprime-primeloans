import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import OpenBorrowersRegistryArtifact
  from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {VariableUtilisationRatesCalculator, OpenBorrowersRegistry, Pool} from "../../typechain";

chai.use(solidity);

const ZERO = ethers.constants.AddressZero;

const {deployContract, provider} = waffle;

describe('Pool with variable utilisation interest rates', () => {
  describe('Single borrowing with interest rates', () => {
    let sut: Pool,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      VariableUtilisationRatesCalculator: VariableUtilisationRatesCalculator;

    before("Deploy Pool contract", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);
      sut = await deployContract(owner, PoolArtifact) as Pool;

      VariableUtilisationRatesCalculator = await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator;
      const borrowersRegistry = await deployContract(owner, OpenBorrowersRegistryArtifact) as OpenBorrowersRegistry;

      await sut.initialize(VariableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);

      await sut.connect(depositor).deposit({value: toWei("2.0")});
    });

    it("should borrow", async () => {
      await sut.borrow(toWei("1.0"));
      expect(await provider.getBalance(sut.address)).to.be.equal(toWei("1", "ether"));

      let borrowed = fromWei(await sut.getBorrowed(owner.address));
      expect(borrowed).to.be.closeTo(1.000000, 0.000001);
    });

    it("should keep the loan for 1 year", async () => {
      await time.increase(time.duration.years(1));

      let borrowed = fromWei(await sut.getBorrowed(owner.address));
      expect(borrowed).to.be.closeTo(1.11627807024, 0.000001);
    });

    it("should repay", async () => {
      await sut.repay({value: toWei("1.11627807024")});

      let borrowed = fromWei(await sut.getBorrowed(owner.address));
      expect(borrowed).to.be.closeTo(0, 0.000001);
    });

  });

  describe('Single borrowing after a delay', () => {
    let sut: Pool,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      VariableUtilisationRatesCalculator;

    before("Deploy Pool contract", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);
      VariableUtilisationRatesCalculator = await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator;
      sut = await deployContract(owner, PoolArtifact) as Pool;

      let borrowersRegistry = await deployContract(owner, OpenBorrowersRegistryArtifact) as OpenBorrowersRegistry;

      await sut.initialize(VariableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
      await sut.connect(depositor).deposit({value: toWei("2.0")});
    });

    it("should wait for 1 year", async () => {
      await time.increase(time.duration.years(1));

      let borrowed = fromWei(await sut.getBorrowed(owner.address));
      expect(borrowed).to.be.closeTo(0, 0.000001);
    });

    it("should borrow", async () => {
      await sut.borrow(toWei("1.0"));
      expect(await provider.getBalance(sut.address)).to.be.equal(toWei("1", "ether"));

      let borrowed = fromWei(await sut.getBorrowed(owner.address));
      expect(borrowed).to.be.closeTo(1.000000, 0.000001);
    });

    it("should keep the loan for 1 year", async () => {
      await time.increase(time.duration.years(1));

      let borrowed = fromWei(await sut.getBorrowed(owner.address));
      expect(borrowed).to.be.closeTo(1.11627807024, 0.000001);
    });

    it("should repay", async () => {
      await sut.repay({value: toWei("1.11627807024")});

      let borrowed = fromWei(await sut.getBorrowed(owner.address));
      expect(borrowed).to.be.closeTo(0, 0.000001);
    });

  });

  describe('Borrowing close to pool utilisation threshold', () => {
    let sut: Pool,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      VariableUtilisationRatesCalculator;

    before("Deploy Pool contract", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);
      VariableUtilisationRatesCalculator = await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator;
      sut = await deployContract(owner, PoolArtifact) as Pool;

      let borrowersRegistry = await deployContract(owner, OpenBorrowersRegistryArtifact) as OpenBorrowersRegistry;

      await sut.initialize(VariableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
      await sut.connect(depositor).deposit({value: toWei("1.0")});
    });

    it("should be able to borrow at threshold", async () => {
      await sut.borrow(toWei("0.95"));

      let borrowed = fromWei(await sut.getBorrowed(owner.address));
      expect(borrowed).to.be.closeTo(0.95, 0.000001);
    });

    it("should not be able to borrow above threshold", async () => {
      await expect(sut.borrow(toWei("0.01"))).to.be.revertedWith("PoolUtilisationTooHighForBorrowing()");

      let borrowed = fromWei(await sut.getBorrowed(owner.address));
      expect(borrowed).to.be.closeTo(0.95, 0.000001);
    });
  });
});
