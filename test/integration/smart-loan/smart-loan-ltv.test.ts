import chai, {expect} from 'chai'
import {deployContract, solidity} from "ethereum-waffle";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import VariableUtilisationRatesCalculatorArtifact
  from '../../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import ERC20PoolArtifact from '../../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenArtifact from "../../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import {
  Asset,
  deployAndInitPangolinExchangeContract,
  getFixedGasSigners,
  recompileSmartLoanLib,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  CompoundingIndex,
  ERC20Pool,
  LTVLib,
  MockSmartLoanLogicFacetRedstoneProvider,
  MockToken,
  OpenBorrowersRegistry__factory,
  PangolinExchange, SmartLoanLogicFacet,
  SmartLoansFactory,
  VariableUtilisationRatesCalculator,
  YieldYakRouter__factory
} from "../../../typechain";
import {ethers} from "hardhat";
import {deployDiamond, deployFacet} from '../../../tools/diamond/deploy-diamond';
import {Contract} from "ethers";
import {WrapperBuilder} from "redstone-evm-connector";

chai.use(solidity);

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });


  describe('A loan with edge LTV cases', () => {
    let exchange: PangolinExchange,
        smartLoansFactory: SmartLoansFactory,
        loan: MockSmartLoanLogicFacetRedstoneProvider,
        wrappedLoan: any,
        mockUsdToken: MockToken,
        yakRouterContract: Contract,
        usdPool: ERC20Pool,
        ltvlib: LTVLib,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        diamondAddress: any;

    before("deploy factory, exchange, wavaxPool and usdPool", async () => {
      diamondAddress = await deployDiamond();
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      usdPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;

      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

      mockUsdToken = (await deployContract(owner, MockTokenArtifact, [[owner.address, depositor.address]])) as MockToken;

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [usdPool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [usdPool.address])) as CompoundingIndex;

      await usdPool.initialize(
          variableUtilisationRatesCalculator.address,
          borrowersRegistry.address,
          depositIndex.address,
          borrowingIndex.address,
          mockUsdToken.address
      );

      await mockUsdToken.connect(depositor).approve(usdPool.address, toWei("1000"));
      await usdPool.connect(depositor).deposit(toWei("1000"));

      let supportedAssets = [
        new Asset(toBytes32('USDT'), mockUsdToken.address)
      ]
      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, supportedAssets);

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      await recompileSmartLoanLib(
          "SmartLoanLib",
          [0],
          [mockUsdToken.address],
          {'USDT': usdPool.address},
          exchange.address,
          yakRouterContract.address,
          'lib'
      );

      // Deploy LTVLib and later link contracts to it
      const LTVLib = await ethers.getContractFactory('LTVLib');
      ltvlib = await LTVLib.deploy() as LTVLib;

      await deployFacet("MockSmartLoanLogicFacetAlwaysSolvent", diamondAddress, [], ltvlib.address)

      await smartLoansFactory.initialize(diamondAddress);
    });

    it("should deploy a smart loan", async () => {
      await smartLoansFactory.connect(owner).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
      const loanFactory = await ethers.getContractFactory("MockSmartLoanLogicFacetAlwaysSolvent", {
        libraries: {
          LTVLib: ltvlib.address
        }
      });
      loan = await loanFactory.attach(loan_proxy_address).connect(owner) as SmartLoanLogicFacet;

      wrappedLoan = WrapperBuilder
          .wrapLite(loan)
          .usingPriceFeed("redstone-avalanche-prod")
    });

    it("should check debt equal to 0", async () => {
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
      expect(await wrappedLoan.isSolvent()).to.be.true;

      await mockUsdToken.connect(owner).approve(wrappedLoan.address, toWei("100"));
      await wrappedLoan.fund(toBytes32("USDT"), toWei("100"));

      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should check debt greater than 0 and lesser than totalValue", async () => {
      await wrappedLoan.borrow(toBytes32("USDT"), toWei("25"));

      expect(await wrappedLoan.getLTV()).to.be.equal(250);
    });

    it("should check LTV 4999", async () => {
      await wrappedLoan.borrow(toBytes32("USDT"), toWei("474"));

      expect(await wrappedLoan.getLTV()).to.be.equal(4990);
    });

    it("should check LTV 5000", async () => {
      await wrappedLoan.borrow(toBytes32("USDT"), toWei("1"));

      expect(await wrappedLoan.getLTV()).to.be.equal(5000);
    });

    it("should check LTV 5010", async () => {
      await wrappedLoan.borrow(toBytes32("USDT"), toWei("1"));

      expect(await wrappedLoan.getLTV()).to.be.equal(5010);
    });
  });
});

