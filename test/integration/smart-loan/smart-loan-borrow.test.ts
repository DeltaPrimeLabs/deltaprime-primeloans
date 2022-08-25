import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
  Asset, deployAllFacets, deployAndInitializeLendingPool,
  fromWei,
  getFixedGasSigners, PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  TokenManager, SmartLoanGigaChadInterface,
  SmartLoansFactory,
  RedstoneConfigManager__factory,
} from "../../../typechain";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
const {deployContract} = waffle;

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)'
]

const wavaxAbi = [
  'function deposit() public payable',
  ...erc20ABI
]

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });


  describe('A loan with debt and repayment', () => {
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

    before("deploy factory, WrappedNativeTokenPool and usdPool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"], 30));

      let lendingPools = [];
      // TODO: Possibly further extract the body of this for loop into a separate function shared among test suits
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

      await recompileSmartLoanLib(
          "SmartLoanConfigLib",
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

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
      loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

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
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);

      await tokenContracts['MCKUSD'].connect(owner).approve(wrappedLoan.address, toWei("1000"));
      await wrappedLoan.fund(toBytes32("MCKUSD"), toWei("300"));

      expect(fromWei(await tokenContracts['MCKUSD'].connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(300);
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(300, 0.5);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should fail to borrow funds as a non-owner", async () => {
      let nonOwnerWrappedLoan = WrapperBuilder
          .mockLite(loan.connect(depositor))
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })
      await expect(nonOwnerWrappedLoan.borrow(toBytes32("MCKUSD"), toWei("300"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
    });


    it("should borrow funds in the same token as funded", async () => {
      await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("300"));
      expect(fromWei(await tokenContracts['MCKUSD'].connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(600);
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(300 + 300, 1);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300, 0.5);
      expect(await wrappedLoan.getLTV()).to.be.equal(1000);
    });

    it("should borrow funds in a different token than funded", async () => {
      await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1"));

      expect(fromWei(await tokenContracts['AVAX'].connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(1);
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(600 + AVAX_PRICE * 1, 1);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300 + AVAX_PRICE * 1, 1);
      expect(await wrappedLoan.getLTV()).to.be.closeTo(((300 + AVAX_PRICE) * 1000 / 300).toFixed(0), 1)
    });

    it("should fail to repay funds as a non-owner", async () => {
      let nonOwnerWrappedLoan = WrapperBuilder
          .mockLite(loan.connect(depositor))
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })
      await expect(nonOwnerWrappedLoan.repay(toBytes32("MCKUSD"), toWei("300"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
    });

    it("should repay funds", async () => {
      await wrappedLoan.repay(toBytes32("MCKUSD"), toWei("100"));
      await wrappedLoan.repay(toBytes32("AVAX"), toWei("0.5"));

      expect(fromWei(await tokenContracts['MCKUSD'].connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(500);
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(500 + AVAX_PRICE * 0.5, 1);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(200 + AVAX_PRICE * 0.5, 1);
      expect(await wrappedLoan.getLTV()).to.be.closeTo(((200 + AVAX_PRICE * 0.5) * 1000 / 300).toFixed(0), 1)
    });


    it("should prevent borrowing too much", async () => {
      await expect(wrappedLoan.borrow(toBytes32("AVAX"), toWei("900"))).to.be.revertedWith("The action may cause an account to become insolvent");
      expect(fromWei(await tokenContracts['AVAX'].connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(0.5);
    });

    it("should repay the debt when specified too much", async () => {
      await tokenContracts['AVAX'].connect(owner).deposit({value: toWei("0.1")});
      await tokenContracts['AVAX'].connect(owner).approve(wrappedLoan.address, toWei("0.1"));

      await wrappedLoan.fund(toBytes32("AVAX"), toWei("0.1"));
      await wrappedLoan.repay(toBytes32("AVAX"), toWei("0.6"));

      expect(fromWei(await tokenContracts['AVAX'].connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(0.1, 0.000001);
    });
  });
});

