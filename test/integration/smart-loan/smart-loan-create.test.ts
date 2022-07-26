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
  deployAndInitPangolinExchangeContract,
  fromWei,
  getFixedGasSigners,
  PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  MockSmartLoanLogicFacetRedstoneProvider,
  PangolinExchange,
  PoolManager, SmartLoanGigaChadInterface,
  SmartLoansFactory,
  YieldYakRouter__factory
} from "../../../typechain";
import {Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/token_addresses.json';
import redstone from "redstone-api";

chai.use(solidity);

const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)'
]

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });


  describe('Creating a loan', () => {
    let exchange: PangolinExchange,
        smartLoansFactory: SmartLoansFactory,
        loan: SmartLoanGigaChadInterface,
        wrappedLoan: any,
        yakRouterContract: Contract,
        tokenContracts: any = {},
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        borrower1: SignerWithAddress,
        borrower2: SignerWithAddress,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number,
        ETH_PRICE: number;

    before("deploy factory, exchange, wavaxPool and usdPool", async () => {
      [owner, depositor, borrower1, borrower2] = await getFixedGasSigners(10000000);

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
      await wrappedSmartLoansFactory.createAndFundLoan(toBytes32("AVAX"), TOKEN_ADDRESSES['AVAX'], toWei("1"), toBytes32("USD"), toWei((2 * AVAX_PRICE).toString()));

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
      expect(fromWei((await wrappedLoan.getOwnedAssetsBalances())[0])).to.equal(1);
      expect(fromWei((await wrappedLoan.getOwnedAssetsBalances())[1])).to.be.closeTo(2 * AVAX_PRICE, 0.05);
      expect(fromWei(await tokenContracts['AVAX'].balanceOf(loan.address))).to.equal(1);
      expect(fromWei(await tokenContracts['USD'].balanceOf(loan.address))).to.be.closeTo(2 * AVAX_PRICE, 0.05);
    });
  });
});

