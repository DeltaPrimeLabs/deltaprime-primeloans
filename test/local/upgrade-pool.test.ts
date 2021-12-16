import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
  from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import TransparentUpgradeableProxyArtifact
  from '../../artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json';
import OpenBorrowersRegistryArtifact
  from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import MockUpgradedPoolArtifact from '../../artifacts/contracts/mock/MockUpgradedPool.sol/MockUpgradedPool.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, toWei} from "../_helpers";
import {
  MockUpgradedPool,
  OpenBorrowersRegistry,
  Pool,
  TransparentUpgradeableProxy,
  VariableUtilisationRatesCalculator
} from "../../typechain";

chai.use(solidity);

const {deployContract, provider} = waffle;
const ZERO = ethers.constants.AddressZero;

describe('Upgradeable pool', () => {

  describe('Basic upgradeability functionalities', () => {
    let pool: Pool,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      depositor2: SignerWithAddress,
      borrower: SignerWithAddress,
      admin: SignerWithAddress,
      VariableUtilisationRatesCalculator: VariableUtilisationRatesCalculator,
      borrowersRegistry: OpenBorrowersRegistry,
      proxy: TransparentUpgradeableProxy;

    it("should deploy a contract behind a proxy", async () => {
      [owner, depositor, borrower, admin, depositor2] = await getFixedGasSigners(10000000);
      pool = await deployContract(owner, PoolArtifact) as Pool;

      proxy = await deployContract(owner, TransparentUpgradeableProxyArtifact, [pool.address, admin.address, []]) as TransparentUpgradeableProxy;
      pool =  (await deployContract(owner, PoolArtifact) as Pool).attach(proxy.address);

      VariableUtilisationRatesCalculator = await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator;
      borrowersRegistry = await deployContract(owner, OpenBorrowersRegistryArtifact) as OpenBorrowersRegistry;

      await pool.initialize(VariableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
    });


    it("should deposit and borrow using proxy", async () => {
      await pool.connect(depositor).deposit({value: toWei("1.0")});
      expect(fromWei(await pool.balanceOf(depositor.address))).to.be.closeTo(1, 0.000001);

      await pool.connect(borrower).borrow(toWei("0.5"));
      expect(fromWei(await pool.getBorrowed(borrower.address))).to.be.closeTo(0.5, 0.000001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0.5, 0.000001);
    });


    it("should prevent non admin from upgrade", async () => {
      let mockUpgradedPool = await deployContract(owner, MockUpgradedPoolArtifact) as MockUpgradedPool;
      await expect(proxy.connect(owner).upgradeTo(mockUpgradedPool.address))
        .to.be.revertedWith("Transaction reverted: function selector was not recognized and there's no fallback function");
    });


    it("should upgrade keeping old state", async () => {
      let mockUpgradedPool = await deployContract(owner, MockUpgradedPoolArtifact) as MockUpgradedPool;

      await proxy.connect(admin).upgradeTo(mockUpgradedPool.address);

      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0.5, 0.000001);
      expect(fromWei(await pool.balanceOf(depositor.address))).to.be.closeTo(1, 0.000001);
      expect(fromWei(await pool.getBorrowed(borrower.address))).to.be.closeTo(0.5, 0.000001);
    });


    it("should have new logic after upgrade", async () => {
      //Upgraded logic doubles deposits value
      await pool.connect(depositor2).deposit({value: toWei("1.0")});
      expect(fromWei(await pool.balanceOf(depositor2.address))).to.be.closeTo(2, 0.000001);
    });

    it("should allow owner-only functions after upgrade", async () => {
      let ratesCalculatorV2 = await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator;

      //Should prevent setting new value from non-owner
      await expect(pool.connect(depositor).setRatesCalculator(ratesCalculatorV2.address))
        .to.be.revertedWith("Ownable: caller is not the owner");

      //Should allow setting new value
      await pool.connect(owner).setRatesCalculator(ratesCalculatorV2.address);
    });
  });

});
