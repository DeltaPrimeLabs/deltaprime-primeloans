import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import VariableUtilisationRatesCalculatorArtifact
  from '../../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import ERC20PoolArtifact from '../../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  Asset,
  deployAndInitPangolinExchangeContract,
  fromWei,
  getFixedGasSigners,
  getSelloutRepayAmount,
  recompileSmartLoanLib,
  toBytes32,
  toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
  CompoundingIndex,
  ERC20Pool,
  LTVLib,
  MockSmartLoanLiquidationFacetRedstoneProvider,
  MockSmartLoanLogicFacetRedstoneProvider,
  MockSmartLoanLogicFacetRedstoneProvider__factory,
  OpenBorrowersRegistry__factory,
  PangolinExchange,
  SmartLoansFactory,
  UpgradeableBeacon,
  VariableUtilisationRatesCalculator,
  YieldYakRouter__factory
} from "../../../typechain";
import {Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";

chai.use(solidity);

const {deployDiamond, deployFacet, replaceFacet} = require('./utils/deploy-diamond');
const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const linkTokenAddress = '0x5947bb275c521040051d82396192181b413227a3';
const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdTokenAddress = '0xc7198437980c041c805a1edcba50c1ce5db95118';
const ethTokenAddress = '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB';
const btcTokenAddress = '0x50b7545627a5162F82A992c33b87aDc75187B218';

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function transfer(address dst, uint wad) public returns (bool)'
]

const wavaxAbi = [
  'function deposit() public payable',
  ...erc20ABI
]

const TEST_TABLE =  [
  {
    id: 1,
    fund: {
      AVAX: 1,
      USD: 0,
      LINK: 0,
      ETH: 0,
      BTC: 0
    },
    borrow: {
      AVAX: 3,
      USD: 0,
      ETH: 0
    },
    orderOfLiquidation: [0, 1, 2]
  },
  {
    id: 2,
    fund: {
      AVAX: 1,
      USD: 0,
      LINK: 0,
      ETH: 0,
      BTC: 0
    },
    borrow: {
      AVAX: 3,
      USD: 0,
      ETH: 0
    },
    orderOfLiquidation: [2, 1, 0]
  },
  {
    id: 3,
    fund: {
      AVAX: 0,
      USD: 0,
      LINK: 0,
      ETH: 0.03,
      BTC: 0
    },
    borrow: {
      AVAX: 1,
      USD: 100,
      ETH: 0.05
    },
    orderOfLiquidation: [1, 2, 0]
 },
  {
    id: 4,
    fund: {
      AVAX: 0.1,
      USD: 10,
      LINK: 1,
      ETH: 0.01,
      BTC: 0.00005
    },
    borrow: {
      AVAX: 0.05,
      USD: 1,
      ETH: 0.05
    },
    orderOfLiquidation: [0, 1, 2]
  }
]

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('A liquidated loan', () => {
    let exchange: PangolinExchange,
        loan: MockSmartLoanLogicFacetRedstoneProvider,
        loanLiquidation: MockSmartLoanLiquidationFacetRedstoneProvider,
        wrappedLoan: any,
        wrappedLoanLiquidation: any,
        owner: SignerWithAddress,
        borrower: SignerWithAddress,
        depositor: SignerWithAddress,
        usdPool: ERC20Pool,
        ethPool: ERC20Pool,
        wavaxPool: ERC20Pool,
        admin: SignerWithAddress,
        liquidator: SignerWithAddress,
        usdTokenContract: Contract,
        linkTokenContract: Contract,
        ethTokenContract: Contract,
        wavaxTokenContract: Contract,
        yakRouterContract: Contract,
        btcTokenContract: Contract,
        smartLoansFactory: SmartLoansFactory,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        LINK_PRICE: number,
        USD_PRICE: number,
        ETH_PRICE: number,
        BTC_PRICE: number,
        diamondAddress: any,
        ltvlib: LTVLib;

    before("deploy provider, exchange and pool", async () => {
      diamondAddress = await deployDiamond();
      [owner, depositor, borrower, admin, liquidator] = await getFixedGasSigners(10000000);

      usdPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
      wavaxPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
      ethPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;

      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      ethTokenContract = new ethers.Contract(ethTokenAddress, erc20ABI, provider);
      btcTokenContract = new ethers.Contract(btcTokenAddress, erc20ABI, provider);
      wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider);

      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
        new Asset(toBytes32('AVAX'), wavaxTokenAddress),
        new Asset(toBytes32('USD'), usdTokenAddress),
        new Asset(toBytes32('LINK'), linkTokenAddress),
        new Asset(toBytes32('ETH'), ethTokenAddress),
        new Asset(toBytes32('BTC'), btcTokenAddress)
      ]);

      const variableUtilisationRatesCalculatorWavax = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      const borrowersRegistryWavax = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndexWavax = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;
      const borrowingIndexWavax = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;

      const variableUtilisationRatesCalculatorUsd = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      const borrowersRegistryUsd = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndexUsd = (await deployContract(owner, CompoundingIndexArtifact, [usdPool.address])) as CompoundingIndex;
      const borrowingIndexUsd = (await deployContract(owner, CompoundingIndexArtifact, [usdPool.address])) as CompoundingIndex;

      const variableUtilisationRatesCalculatorEth = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      const borrowersRegistryEth = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndexEth = (await deployContract(owner, CompoundingIndexArtifact, [ethPool.address])) as CompoundingIndex;
      const borrowingIndexEth = (await deployContract(owner, CompoundingIndexArtifact, [ethPool.address])) as CompoundingIndex;

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      LINK_PRICE = (await redstone.getPrice('LINK')).value;
      ETH_PRICE = (await redstone.getPrice('ETH')).value;
      BTC_PRICE = (await redstone.getPrice('BTC')).value;

      MOCK_PRICES = [
        {
          symbol: 'USD',
          value: USD_PRICE
        },
        {
          symbol: 'LINK',
          value: LINK_PRICE
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        },
        {
          symbol: 'ETH',
          value: ETH_PRICE
        },
        {
          symbol: 'BTC',
          value: BTC_PRICE
        }
      ];

      //initialize pools
      await wavaxPool.initialize(
          variableUtilisationRatesCalculatorWavax.address,
          borrowersRegistryWavax.address,
          depositIndexWavax.address,
          borrowingIndexWavax.address,
          wavaxTokenContract.address
      );

      await ethPool.initialize(
          variableUtilisationRatesCalculatorEth.address,
          borrowersRegistryEth.address,
          depositIndexEth.address,
          borrowingIndexEth.address,
          ethTokenContract.address
      );

      await usdPool.initialize(
          variableUtilisationRatesCalculatorUsd.address,
          borrowersRegistryUsd.address,
          depositIndexUsd.address,
          borrowingIndexUsd.address,
          usdTokenAddress
      );

      //initial deposits

      //deposit AVAX
      await wavaxTokenContract.connect(depositor).deposit({value: toWei("1000")});
      await wavaxTokenContract.connect(depositor).approve(wavaxPool.address, toWei("1000"));
      await wavaxPool.connect(depositor).deposit(toWei("1000"));

      //deposit other tokens
      await depositToPool("USD", usdTokenContract, usdPool, 10000, USD_PRICE);
      await depositToPool("ETH", ethTokenContract, ethPool, 1, ETH_PRICE);

      async function depositToPool(symbol: string, tokenContract: Contract, pool: ERC20Pool, amount: number, price: number) {
        const initialTokenDepositWei = parseUnits(amount.toString(), await tokenContract.decimals());
        let requiredAvax = toWei((amount * price * 1.5 / AVAX_PRICE).toString());

        await wavaxTokenContract.connect(depositor).deposit({value: requiredAvax});
        await wavaxTokenContract.connect(depositor).transfer(exchange.address, requiredAvax);
        await exchange.connect(depositor).swap(toBytes32("AVAX"), toBytes32(symbol), requiredAvax, initialTokenDepositWei);

        await tokenContract.connect(depositor).approve(pool.address, initialTokenDepositWei);
        await pool.connect(depositor).deposit(initialTokenDepositWei);
      }
    });

    before("prepare smart loan implementations", async () => {
      await recompileSmartLoanLib("SmartLoanLib", [0, 1, 3], {'AVAX': wavaxPool.address, 'USD': usdPool.address, 'ETH': ethPool.address},  exchange.address, yakRouterContract.address, 'lib');

      // Deploy LTVLib and later link contracts to it
      const LTVLib = await ethers.getContractFactory('LTVLib');
      ltvlib = await LTVLib.deploy() as LTVLib;

      await deployFacet("MockSmartLoanLogicFacetRedstoneProvider", diamondAddress, [], ltvlib.address);
      await deployFacet("MockSmartLoanLiquidationFacetRedstoneProvider", diamondAddress, ["liquidateLoan"], ltvlib.address);


    });

    beforeEach("create a loan", async () => {
      await recompileSmartLoanLib('SmartLoanLib', [0, 1, 3], {'AVAX': wavaxPool.address, 'USD': usdPool.address, 'ETH': ethPool.address},  exchange.address, yakRouterContract.address, 'lib');

      // Deploy LTVLib and later link contracts to it
      const LTVLib = await ethers.getContractFactory('LTVLib');
      ltvlib = await LTVLib.deploy() as LTVLib;

      await replaceFacet("MockSmartLoanLogicFacetRedstoneProvider", diamondAddress, [], ltvlib.address);

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(diamondAddress);

      await smartLoansFactory.connect(borrower).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

      const loanFactory = await ethers.getContractFactory("MockSmartLoanLogicFacetRedstoneProvider", {
        libraries: {
          LTVLib: ltvlib.address
        }
      });
      const loanFactoryLiquidation = await ethers.getContractFactory("MockSmartLoanLiquidationFacetRedstoneProvider", {
        libraries: {
          LTVLib: ltvlib.address
        }
      });
      loan = await loanFactory.attach(loan_proxy_address).connect(borrower) as MockSmartLoanLogicFacetRedstoneProvider;
      loanLiquidation = await loanFactoryLiquidation.attach(loan_proxy_address).connect(borrower) as MockSmartLoanLiquidationFacetRedstoneProvider;

      wrappedLoan = WrapperBuilder
          .mockLite(loan)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })
      wrappedLoanLiquidation = WrapperBuilder
          .mockLite(loanLiquidation)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })
    });

      TEST_TABLE.forEach(
      async testCase => {
        it(`Testcase ${testCase.id}:\n
        fund AVAX: ${testCase.fund.AVAX}, USD: ${testCase.fund.USD}, ETH: ${testCase.fund.ETH}, LINK: ${testCase.fund.LINK}\n
        borrow AVAX: ${testCase.fund.AVAX}, USD: ${testCase.fund.USD}, ETH: ${testCase.fund.ETH}`,
        async () => {

          //fund
          for (const [symbol, value] of Object.entries(testCase.fund)) {
            if (value > 0) {
              let contract = getTokenContract(symbol)!;
              let tokenDecimals = await contract.decimals();

              let requiredAvax = toWei((value * getPrice(symbol)! * 1.5 / AVAX_PRICE).toString());
              await wavaxTokenContract.connect(borrower).deposit({value: requiredAvax});

              if (symbol !== 'AVAX') {
                await wavaxTokenContract.connect(borrower).transfer(exchange.address, requiredAvax);
                await exchange.connect(borrower).swap(toBytes32("AVAX"), toBytes32(symbol), requiredAvax, toWei(value.toString(), tokenDecimals));
              }

              await contract.connect(borrower).approve(wrappedLoan.address, toWei(value.toString(), tokenDecimals));
              await wrappedLoan.fund(toBytes32(symbol), toWei(value.toString(), tokenDecimals));
            }
          }

          for (const [symbol, value] of Object.entries(testCase.borrow)) {
            if (value > 0) {
              let contract = getTokenContract(symbol)!;
              let tokenDecimals = await contract.decimals();

              await wrappedLoan.borrow(toBytes32(symbol), toWei(value.toString(), tokenDecimals));
            }
          }

          await liquidateLoan(testCase.orderOfLiquidation);
        });
      }
   );


    async function liquidateLoan(orderOfLiquidation: number[]) {
      await recompileSmartLoanLib("SmartLoanLib", [0, 1, 3], {'AVAX': wavaxPool.address, 'USD': usdPool.address, 'ETH': ethPool.address},  exchange.address, yakRouterContract.address, 'lib', 2000, 1000);

      // Deploy LTVLib and later link contracts to it
      const LTVLib = await ethers.getContractFactory('LTVLib');
      ltvlib = await LTVLib.deploy() as LTVLib;

      await replaceFacet("MockSmartLoanLogicFacetRedstoneProvider", diamondAddress, [], ltvlib.address);

      expect(await wrappedLoan.isSolvent()).to.be.false;

      loan = loan.connect(liquidator);

      wrappedLoan = WrapperBuilder
          .mockLite(loan)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })

      const repayAmount = await getSelloutRepayAmount(
          await wrappedLoan.getTotalValue(),
          await wrappedLoan.getDebt(),
          await wrappedLoan.getMaxLiquidationBonus(),
          await wrappedLoan.getMaxLtv()
      )

      let previousLiquidatorBalance = await wavaxTokenContract.balanceOf(liquidator.address);

      await wrappedLoanLiquidation.liquidateLoan(repayAmount.toLocaleString('fullwide', {useGrouping: false}), orderOfLiquidation);

      expect((fromWei(await wavaxTokenContract.balanceOf(liquidator.address)) - fromWei(previousLiquidatorBalance)) * AVAX_PRICE).to.be.closeTo(
          (((await wrappedLoan.getMaxLiquidationBonus()).toNumber()) * repayAmount / 10**18 / (await wrappedLoan.getPercentagePrecision()).toNumber()), 1);

      expect(await wrappedLoan.isSolvent()).to.be.true;
    }

    function getTokenContract(symbol: string) {
      if (symbol == "AVAX") return wavaxTokenContract;
      if (symbol == "USD") return usdTokenContract;
      if (symbol == "ETH") return ethTokenContract;
      if (symbol == "LINK") return linkTokenContract;
      if (symbol == "BTC") return btcTokenContract;
    }

    function getPrice(symbol: string) {
      if (symbol == "AVAX") return AVAX_PRICE;
      if (symbol == "USD") return USD_PRICE;
      if (symbol == "ETH") return ETH_PRICE;
      if (symbol == "LINK") return LINK_PRICE;
      if (symbol == "BTC") return BTC_PRICE;
    }
  });
});

