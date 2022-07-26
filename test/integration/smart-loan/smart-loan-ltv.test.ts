import chai, {expect} from 'chai'
import {deployContract, solidity} from "ethereum-waffle";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import PoolManagerArtifact from '../../../artifacts/contracts/PoolManager.sol/PoolManager.json';
import {
  Asset,
  deployAllFaucets,
  deployAndInitializeLendingPool,
  deployAndInitPangolinExchangeContract,
  getFixedGasSigners,
  PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  ERC20Pool,
  MockSmartLoanLogicFacetRedstoneProvider,
  MockToken,
  PangolinExchange,
  PoolManager, SmartLoanGigaChadInterface,
  SmartLoansFactory,
  YieldYakRouter__factory
} from "../../../typechain";
import {ethers} from "hardhat";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import {Contract} from "ethers";
import {WrapperBuilder} from "redstone-evm-connector";
import TOKEN_ADDRESSES from "../../../common/token_addresses.json";

chai.use(solidity);

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });


  describe('A loan with edge LTV cases', () => {
    let exchange: PangolinExchange,
        smartLoansFactory: SmartLoansFactory,
        loan: SmartLoanGigaChadInterface,
        wrappedLoan: any,
        mockUsdToken: MockToken,
        yakRouterContract: Contract,
        tokenContracts: any = {},
        owner: SignerWithAddress,
        depositor: SignerWithAddress;

    before("deploy factory, exchange, wavaxPool and usdPool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      let lendingPools = [];
      for (const token of [
        {'name': 'USD', 'airdropList': [owner.address, depositor.address]},
        {'name': 'AVAX', 'airdropList': [depositor]}
      ]) {
        let {poolContract, tokenContract} = await deployAndInitializeLendingPool(owner, token.name, token.airdropList);
        await tokenContract!.connect(depositor).approve(poolContract.address, toWei("1000"));
        await poolContract.connect(depositor).deposit(toWei("1000"));
        lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
        tokenContracts[token.name] = tokenContract;
      }

      let supportedAssets = [
        new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
        new Asset(toBytes32('USD'), tokenContracts['USD'].address),
        new Asset(toBytes32('ETH'), TOKEN_ADDRESSES['ETH']),
      ]

      let poolManager = await deployContract(
          owner,
          PoolManagerArtifact,
          [
            supportedAssets,
            lendingPools
          ]
      ) as PoolManager;

      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

      // TODO: Check if it's possibl to avoid doulbe-recompilation
      await recompileSmartLoanLib(
          "SmartLoanLib",
          yakRouterContract.address,
          ethers.constants.AddressZero,
          poolManager.address,
          ethers.constants.AddressZero,
          'lib'
      );
      //TODO: Refactor syntax
      let {diamondAddress, solvencyFacetAddress} = await deployDiamond();

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await recompileSmartLoanLib(
          "SmartLoanLib",
          yakRouterContract.address,
          ethers.constants.AddressZero,
          poolManager.address,
          solvencyFacetAddress,
          'lib'
      );
      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, supportedAssets);

      await deployAllFaucets(diamondAddress)

      await smartLoansFactory.initialize(diamondAddress);
    });

    it("should deploy a smart loan", async () => {
      await smartLoansFactory.connect(owner).createLoan();

      const loanAddress = await smartLoansFactory.getLoanForOwner(owner.address);
      loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, owner);

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

