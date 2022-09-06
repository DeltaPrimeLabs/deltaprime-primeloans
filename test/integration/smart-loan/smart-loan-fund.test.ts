import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import DestructableArtifact from '../../../artifacts/contracts/mock/DestructableContract.sol/DestructableContract.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
  Asset, AssetNameBalance, AssetNamePrice, deployAllFacets, deployAndInitializeLendingPool, formatUnits, fromBytes32,
  fromWei, getFixedGasSigners,
  PoolAsset,
  recompileConstantsFile,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  DestructableContract,
  TokenManager, RedstoneConfigManager__factory, SmartLoanGigaChadInterface,
  SmartLoansFactory,
} from "../../../typechain";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
chai.use(solidity);

import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import {BigNumber} from "ethers";
const {deployContract, provider} = waffle;

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });


  describe(`Funding a loan`, () => {
    let smartLoansFactory: SmartLoansFactory,
        loan: SmartLoanGigaChadInterface,
        wrappedLoan: any,
        tokenContracts: any = {},
        destructable: DestructableContract,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number,
        ETH_PRICE: number;

    before("deploy factory, exchange, WrappedNativeTokenPool and usdPool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      // Prepare the Destructable contract to send AVAX to a SmartLoan contract
      destructable = (await deployContract(depositor, DestructableArtifact)) as DestructableContract;
      await depositor.sendTransaction({to: destructable.address, value: toWei("21.37")});

      let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));

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

      let tokenManager = await deployContract(
          owner,
          TokenManagerArtifact,
          [
            supportedAssets,
            lendingPools
          ]
      ) as TokenManager;

      let diamondAddress = await deployDiamond();

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(diamondAddress);

      await recompileConstantsFile(
          'local',
          "DeploymentConstants",
          [],
          tokenManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          smartLoansFactory.address,
          'lib'
      );

      await deployAllFacets(diamondAddress)


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
      await tokenContracts['MCKUSD'].connect(owner).approve(wrappedLoan.address, toWei("1000"));
      await wrappedLoan.fund(toBytes32("MCKUSD"), toWei("300"));

      expect(fromWei(await tokenContracts['MCKUSD'].connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(300);
    });

    it("should return all assets balances", async () => {
      let result = await wrappedLoan.getAllAssetsBalances();
      let assetsNameBalance = [];
      for (const r of result) {
        assetsNameBalance.push(new AssetNameBalance(fromBytes32(r[0]), r[1]));
      }
      expect(assetsNameBalance).to.eql([
          new AssetNameBalance("AVAX", BigNumber.from("0")),
          new AssetNameBalance("MCKUSD", toWei("300")),
          new AssetNameBalance("ETH", BigNumber.from("0")),
      ])
    });

    it("should return all assets prices", async () => {
      let result = await wrappedLoan.getAllAssetsPrices();
      let assetsNamePrice = [];
      for (const r of result) {
        assetsNamePrice.push(new AssetNamePrice(fromBytes32(r[0]), r[1]));
      }
      expect(assetsNamePrice).to.eql([
        new AssetNamePrice("AVAX", BigNumber.from((Math.floor(Number(AVAX_PRICE) * 1e8)).toString())),
        new AssetNamePrice("MCKUSD", BigNumber.from(Math.floor((Number(USD_PRICE) * 1e8)).toString())),
        new AssetNamePrice("ETH", BigNumber.from(Math.floor((Number(ETH_PRICE) * 1e8)).toString())),
      ])
    });

    it("should add native AVAX to SmartLoan using the destructable contract", async () => {
      expect(await provider.getBalance(wrappedLoan.address)).to.be.equal(0);
      await destructable.connect(depositor).destruct(wrappedLoan.address);
      expect(await provider.getBalance(wrappedLoan.address)).to.be.equal(toWei("21.37"));
    });

    it("should fail to wrapNativeToken as a non-owner", async () => {
      let nonOwnerWrappedLoan = WrapperBuilder
          .mockLite(loan.connect(depositor))
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })
      await expect(nonOwnerWrappedLoan.wrapNativeToken(toWei("21.37"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
    });

    it("should wrapNativeToken and then withdraw extra supplied AVAX afterwards", async () => {
      let initialWAVAXBalance = await tokenContracts['AVAX'].balanceOf(wrappedLoan.address);
      await wrappedLoan.wrapNativeToken(toWei("21.37"));
      expect(await tokenContracts['AVAX'].balanceOf(wrappedLoan.address)).to.be.equal(initialWAVAXBalance + toWei("21.37"));
      await wrappedLoan.withdraw(toBytes32("AVAX"), toWei("21.37"));
      expect(await tokenContracts['AVAX'].balanceOf(wrappedLoan.address)).to.be.equal(initialWAVAXBalance);
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
      await expect(wrappedLoan.unwrapAndWithdraw(toWei("30"))).to.be.revertedWith("Not enough native token to unwrap and withdraw");
    });

    it("should fail to withdraw funds as a non-owner", async () => {
      let nonOwnerWrappedLoan = WrapperBuilder
          .mockLite(loan.connect(depositor))
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })
      await expect(nonOwnerWrappedLoan.withdraw(toBytes32("AVAX"), toWei("300"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
    });

    it("should withdraw native token", async () => {
      let providerBalance = fromWei(await provider.getBalance(owner.address));
      await wrappedLoan.unwrapAndWithdraw(toWei("5"));

      expect(fromWei(await provider.getBalance(owner.address))).to.be.closeTo(providerBalance + 5, 0.1);
      //shouldn't change balance of loan
      expect(fromWei(await provider.getBalance(wrappedLoan.address))).to.be.equal(10);
      expect(fromWei(await tokenContracts['AVAX'].balanceOf(wrappedLoan.address))).to.be.equal(5);
    });
  });
});

