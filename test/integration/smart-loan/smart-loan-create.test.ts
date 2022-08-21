import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import PoolManagerArtifact from '../../../artifacts/contracts/PoolManager.sol/PoolManager.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
  Asset,
  deployAllFaucets,
  deployAndInitializeLendingPool,
  fromWei,
  getFixedGasSigners,
  PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  PoolManager,
  RedstoneConfigManager__factory,
  SmartLoanGigaChadInterface,
  SmartLoansFactory,
} from "../../../typechain";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import redstone from "redstone-api";

chai.use(solidity);

const {deployContract} = waffle;

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });


  describe('Creating a loan', () => {
    let smartLoansFactory: SmartLoansFactory,
        loan: SmartLoanGigaChadInterface,
        wrappedLoan: any,
        tokenContracts: any = {},
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        borrower1: SignerWithAddress,
        borrower2: SignerWithAddress,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number,
        ETH_PRICE: number;

    before("deploy factory, exchange, WrappedNativeTokenPool and usdPool", async () => {
      [owner, depositor, borrower1, borrower2] = await getFixedGasSigners(10000000);

      let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"], 30));

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
          smartLoansFactory.address,
          'lib'
      );

      await deployAllFaucets(diamondAddress)
    });


    it("should create a smart loan using createLoan", async () => {
      await smartLoansFactory.connect(borrower1).createLoan();

      const loanAddress = await smartLoansFactory.getLoanForOwner(borrower1.address);
      loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, borrower1);

      wrappedLoan = WrapperBuilder
        .mockLite(loan)
        .using(
          () => {
            return {
              prices: MOCK_PRICES,
              timestamp: Date.now()
            }
          })

      expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(0, 0.01)
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(0, 0.01)
    });


    it("should create a smart loan using createAndFundLoan", async () => {
      const wrappedSmartLoansFactory = WrapperBuilder
          .mockLite(smartLoansFactory.connect(borrower2))
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })

      await tokenContracts['AVAX'].connect(borrower2).deposit({value: toWei("1")});
      await tokenContracts['AVAX'].connect(borrower2).approve(smartLoansFactory.address, toWei("1"));
      await wrappedSmartLoansFactory.createAndFundLoan(toBytes32("AVAX"), TOKEN_ADDRESSES['AVAX'], toWei("1"), toBytes32("MCKUSD"), toWei((2 * AVAX_PRICE).toString()));

      const loanAddress = await smartLoansFactory.getLoanForOwner(borrower2.address);
      loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, borrower2);

      wrappedLoan = WrapperBuilder
          .mockLite(loan)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })

      expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(2 * AVAX_PRICE, 0.05)
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(3 * AVAX_PRICE, 0.05)
      expect(fromWei(await tokenContracts['AVAX'].balanceOf(loan.address))).to.equal(1);
      expect(fromWei(await tokenContracts['MCKUSD'].balanceOf(loan.address))).to.be.closeTo(2 * AVAX_PRICE, 0.05);
    });
  });
});

