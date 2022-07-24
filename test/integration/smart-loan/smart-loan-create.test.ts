import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import VariableUtilisationRatesCalculatorArtifact
  from '../../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import ERC20PoolArtifact from '../../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenArtifact from "../../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
  Asset,
  deployAndInitPangolinExchangeContract,
  fromWei,
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
  PangolinExchange,
  SmartLoansFactory,
  VariableUtilisationRatesCalculator,
  YieldYakRouter__factory
} from "../../../typechain";
import {Contract} from "ethers";
import {deployDiamond, deployFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;
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


  describe('Creating a loan', () => {
    let exchange: PangolinExchange,
        smartLoansFactory: SmartLoansFactory,
        loan: MockSmartLoanLogicFacetRedstoneProvider,
        wrappedLoan: any,
        mockUsdToken: MockToken,
        wavaxTokenContract: Contract,
        ethTokenContract: Contract,
        yakRouterContract: Contract,
        wavaxPool: ERC20Pool,
        usdPool: ERC20Pool,
        ltvlib: LTVLib,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        borrower1: SignerWithAddress,
        borrower2: SignerWithAddress,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number,
        ETH_PRICE: number,
        diamondAddress: any;

    before("deploy factory, exchange, wavaxPool and usdPool", async () => {
      diamondAddress = await deployDiamond();
      [owner, depositor, borrower1, borrower2] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      const variableUtilisationRatesCalculatorERC20 = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      usdPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
      wavaxPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;

      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

      wavaxTokenContract = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);
      ethTokenContract = new ethers.Contract(TOKEN_ADDRESSES['ETH'], wavaxAbi, provider);
      //it's a mock implementation of USD token with 18 decimal places
      mockUsdToken = (await deployContract(owner, MockTokenArtifact, [[owner.address, depositor.address]])) as MockToken;

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [usdPool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [usdPool.address])) as CompoundingIndex;

      const borrowersRegistryERC20 = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndexERC20 = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;
      const borrowingIndexERC20 = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;


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

      await wavaxPool.initialize(
          variableUtilisationRatesCalculatorERC20.address,
          borrowersRegistryERC20.address,
          depositIndexERC20.address,
          borrowingIndexERC20.address,
          wavaxTokenContract.address
      );

      await wavaxTokenContract.connect(depositor).deposit({value: toWei("1000")});
      await wavaxTokenContract.connect(depositor).approve(wavaxPool.address, toWei("1000"));
      await wavaxPool.connect(depositor).deposit(toWei("1000"));

      await usdPool.initialize(
          variableUtilisationRatesCalculator.address,
          borrowersRegistry.address,
          depositIndex.address,
          borrowingIndex.address,
          mockUsdToken.address
      );

      await mockUsdToken.connect(depositor).approve(usdPool.address, toWei("1000"));
      await usdPool.connect(depositor).deposit(toWei("1000"));

      let supportedAssetss = [
        new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
        new Asset(toBytes32('USD'), mockUsdToken.address),
        new Asset(toBytes32('ETH'), TOKEN_ADDRESSES['ETH']),
      ]
      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, supportedAssetss);

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      await recompileSmartLoanLib(
          "SmartLoanLib",
          [0, 1],
          [TOKEN_ADDRESSES['AVAX'], mockUsdToken.address],
          {'AVAX': wavaxPool.address, 'USD': usdPool.address},
          exchange.address,
          yakRouterContract.address,
          'lib'
      );

      // Deploy LTVLib and later link contracts to it
      const LTVLib = await ethers.getContractFactory('LTVLib');
      ltvlib = await LTVLib.deploy() as LTVLib;

      await deployFacet("MockSmartLoanLogicFacetRedstoneProvider", diamondAddress, [], ltvlib.address)

      await smartLoansFactory.initialize(diamondAddress);
    });


    it("should create a smart loan using createLoan", async () => {
      await smartLoansFactory.connect(borrower1).createLoan();

      const loanAddress = await smartLoansFactory.getLoanForOwner(borrower1.address);
      const loanFactory = await ethers.getContractFactory("MockSmartLoanLogicFacetRedstoneProvider", {
        libraries: {
          LTVLib: ltvlib.address
        }
      });
      loan = await loanFactory.attach(loanAddress).connect(borrower1) as MockSmartLoanLogicFacetRedstoneProvider;

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

      await wavaxTokenContract.connect(borrower2).deposit({value: toWei("1")});
      await wavaxTokenContract.connect(borrower2).approve(smartLoansFactory.address, toWei("1"));
      await wrappedSmartLoansFactory.createAndFundLoan(toBytes32("AVAX"), TOKEN_ADDRESSES['AVAX'], toWei("1"), toBytes32("USD"), toWei((2 * AVAX_PRICE).toString()));

      const loanAddress = await smartLoansFactory.getLoanForOwner(borrower2.address);
      const loanFactory = await ethers.getContractFactory("MockSmartLoanLogicFacetRedstoneProvider", {
        libraries: {
          LTVLib: ltvlib.address
        }
      });
      loan = await loanFactory.attach(loanAddress).connect(borrower2) as MockSmartLoanLogicFacetRedstoneProvider;

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
      expect(fromWei((await wrappedLoan.getAllAssetsBalances())[0])).to.equal(1);
      expect(fromWei((await wrappedLoan.getAllAssetsBalances())[1])).to.be.closeTo(2 * AVAX_PRICE, 0.05);
      expect(fromWei(await wavaxTokenContract.balanceOf(loan.address))).to.equal(1);
      expect(fromWei(await mockUsdToken.balanceOf(loan.address))).to.be.closeTo(2 * AVAX_PRICE, 0.05);
    });
  });
});

