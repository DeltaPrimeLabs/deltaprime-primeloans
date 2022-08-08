import chai, {expect} from 'chai'
import {deployContract, solidity} from "ethereum-waffle";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import PoolManagerArtifact from '../../../artifacts/contracts/PoolManager.sol/PoolManager.json';
import {
  Asset,
  deployAllFaucets,
  deployAndInitializeLendingPool,
    getFixedGasSigners,
  PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  MockToken,
  PoolManager, RedstoneConfigManager__factory, SmartLoanGigaChadInterface,
  SmartLoansFactory,
} from "../../../typechain";
import {ethers} from "hardhat";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import {WrapperBuilder} from "redstone-evm-connector";
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";
import redstone from "redstone-api";

chai.use(solidity);


describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });


  describe('A loan with edge LTV cases', () => {
    let smartLoansFactory: SmartLoansFactory,
        loan: SmartLoanGigaChadInterface,
        wrappedLoan: any,
        tokenContracts: any = {},
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number,
        ETH_PRICE: number;

    before("deploy factory, exchange, wavaxPool and usdPool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"], 30));

      let lendingPools = [];
      for (const token of [
        {'name': 'MCKUSD', 'airdropList': [owner.address, depositor.address]},
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
        new Asset(toBytes32('MCKUSD'), tokenContracts['MCKUSD'].address),
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

      let diamondAddress = await deployDiamond();

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(diamondAddress);

      await recompileSmartLoanLib(
          "SmartLoanLib",
          [],
          poolManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          'lib',
          5020
      );

      await deployAllFaucets(diamondAddress)
    });

    it("should deploy a smart loan", async () => {
      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDC')).value;
      ETH_PRICE = (await redstone.getPrice('ETH')).value;

      MOCK_PRICES = [
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        },
        {
          symbol: 'MCKUSD',
          value: USD_PRICE
        },
        {
          symbol: 'ETH',
          value: ETH_PRICE
        }
      ];

      await smartLoansFactory.connect(owner).createLoan();

      const loanAddress = await smartLoansFactory.getLoanForOwner(owner.address);
      loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, owner);

      wrappedLoan = WrapperBuilder
          .mockLite(loan)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })
    });

    it("should check debt equal to 0", async () => {
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
      expect(await wrappedLoan.isSolvent()).to.be.true;

      await tokenContracts['MCKUSD'].connect(owner).approve(wrappedLoan.address, toWei("100"));
      await wrappedLoan.fund(toBytes32("MCKUSD"), toWei("100"));

      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should check debt greater than 0 and lesser than totalValue", async () => {
      await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("25"));

      expect(await wrappedLoan.getLTV()).to.be.equal(250);
    });

    it("should check LTV 4999", async () => {
      await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("474"));

      expect(await wrappedLoan.getLTV()).to.be.equal(4990);
    });

    it("should check LTV 5000", async () => {
      await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("1"));

      expect(await wrappedLoan.getLTV()).to.be.equal(5000);
    });

    it("should check LTV 5010", async () => {
      await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("1"));

      expect(await wrappedLoan.getLTV()).to.be.equal(5010);
    });
  });
});

