import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import PoolManagerArtifact from '../../../artifacts/contracts/PoolManager.sol/PoolManager.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
  Asset, deployAllFaucets, deployAndInitializeLendingPool,
  deployAndInitPangolinExchangeContract,
  fromWei, getFixedGasSigners,
  PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  MockSmartLoanLogicFacetRedstoneProvider,
  PangolinExchange, PoolManager,
  SmartLoansFactory,
  YieldYakRouter__factory
} from "../../../typechain";
import {Contract} from "ethers";
import TOKEN_ADDRESSES from '../../../common/token_addresses.json';

chai.use(solidity);

import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });


  describe(`Funding a loan`, () => {
    let exchange: PangolinExchange,
        smartLoansFactory: SmartLoansFactory,
        loan: MockSmartLoanLogicFacetRedstoneProvider,
        wrappedLoan: any,
        tokenContracts: any = {},
        yakRouterContract: Contract,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number,
        ETH_PRICE: number;

    before("deploy factory, exchange, wavaxPool and usdPool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      ETH_PRICE = (await redstone.getPrice('ETH')).value;

      MOCK_PRICES = [
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        },
        {
          symbol: 'USD',
          value: USD_PRICE
        },
        {
          symbol: 'ETH',
          value: ETH_PRICE
        }
      ];

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
        .mockLite(loan)
        .using(
          () => {
            return {
              prices: MOCK_PRICES,
              timestamp: Date.now()
            }
          })
    });


    it("should fund a loan", async () => {
      await tokenContracts['USD'].connect(owner).approve(wrappedLoan.address, toWei("1000"));
      await wrappedLoan.fund(toBytes32("USD"), toWei("300"));

      expect(fromWei(await tokenContracts['USD'].connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(300);
    });

    it("should deposit native token", async () => {
      await wrappedLoan.depositNativeToken({value: toWei("10")});

      expect(fromWei(await provider.getBalance(wrappedLoan.address))).to.be.equal(0);
      expect(fromWei(await tokenContracts['AVAX'].balanceOf(wrappedLoan.address))).to.be.equal(10);
    });

    it("should receive native token", async () => {
      const tx = await owner.sendTransaction({
        to: wrappedLoan.address,
        value: toWei("10")
      });

      await tx.wait();

      expect(fromWei(await provider.getBalance(wrappedLoan.address))).to.be.equal(10);
      expect(fromWei(await tokenContracts['AVAX'].balanceOf(wrappedLoan.address))).to.be.equal(10);
    });

    it("should revert withdrawing too much native token", async () => {
      console.log(wrappedLoan);
      await expect(wrappedLoan.unwrapAndWithdraw(toWei("30"))).to.be.revertedWith("Not enough WAVAX to unwrap and withdraw");
    });

    it("should withdraw native token", async () => {
      let providerBalance = fromWei(await provider.getBalance(owner.address));
      await wrappedLoan.unwrapAndWithdraw(toWei("5"));

      expect(fromWei(await provider.getBalance(owner.address))).to.be.closeTo(providerBalance + 5, 0.001);
      //shouldn't change balance of loan
      expect(fromWei(await provider.getBalance(wrappedLoan.address))).to.be.equal(10);
      expect(fromWei(await tokenContracts['AVAX'].balanceOf(wrappedLoan.address))).to.be.equal(5);
    });
  });
});

