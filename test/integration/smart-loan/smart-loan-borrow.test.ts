import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import PoolManagerArtifact from '../../../artifacts/contracts/PoolManager.sol/PoolManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
  Asset, deployAllFaucets, deployAndInitializeLendingPool,
  deployAndInitPangolinExchangeContract,
  fromWei,
  getFixedGasSigners, PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  PangolinExchange, PoolManager, SmartLoanGigaChadInterface,
  SmartLoansFactory,
  YieldYakRouter__factory
} from "../../../typechain";
import {Contract} from "ethers";
import TOKEN_ADDRESSES from '../../../common/token_addresses.json';

chai.use(solidity);

import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
const {deployContract} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

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
        yakRouterContract: Contract,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number,
        ETH_PRICE: number;

    before("deploy factory, wavaxPool and usdPool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);
      let lendingPools = [];
      // TODO: Possibly further extract the body of this for loop into a separate function shared among test suits
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

      // TODO: Remove from this testcase as it's obsolete
      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

      let diamondAddress = await deployDiamond();
      await recompileSmartLoanLib(
          "SmartLoanLib",
          yakRouterContract.address,
          ethers.constants.AddressZero,
          poolManager.address,
          diamondAddress,
          'lib'
      );
      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      await deployAllFaucets(diamondAddress)

      await smartLoansFactory.initialize(diamondAddress);
    });


    it("should deploy a smart loan", async () => {
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

      await tokenContracts['USD'].connect(owner).approve(wrappedLoan.address, toWei("1000"));
      await wrappedLoan.fund(toBytes32("USD"), toWei("300"));

      expect(fromWei(await tokenContracts['USD'].connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(300);
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(300, 0.5);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });


    it("should borrow funds in the same token as funded", async () => {
      await wrappedLoan.borrow(toBytes32("USD"), toWei("300"));
      expect(fromWei(await tokenContracts['USD'].connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(600);
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



    it("should repay funds", async () => {
      await wrappedLoan.repay(toBytes32("USD"), toWei("100"));
      await wrappedLoan.repay(toBytes32("AVAX"), toWei("0.5"));

      expect(fromWei(await tokenContracts['USD'].connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(500);
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

