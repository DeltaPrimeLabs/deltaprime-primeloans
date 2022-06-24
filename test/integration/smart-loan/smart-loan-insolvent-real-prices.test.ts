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
  calculateBonus,
  deployAndInitPangolinExchangeContract,
  formatUnits,
  fromBytes32,
  fromWei,
  getFixedGasSigners,
  getRepayAmounts,
  recompileSmartLoanLib,
  toBytes32,
  toRepay,
  toSupply,
  toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
  CompoundingIndex,
  ERC20Pool,
  LTVLib,
  MockSmartLoanLiquidationFacetRedstoneProvider,
  OpenBorrowersRegistry__factory,
  PangolinExchange,
  MockSmartLoanLogicFacetRedstoneProvider,
  SmartLoansFactory,
  VariableUtilisationRatesCalculator,
  YieldYakRouter__factory
} from "../../../typechain";
import {Contract, ContractFactory} from "ethers";
import {parseUnits} from "ethers/lib/utils";

const {deployDiamond, deployFacet, replaceFacet} = require('../../../tools/diamond/deploy-diamond');

chai.use(solidity);

const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const linkTokenAddress = '0x5947bb275c521040051d82396192181b413227a3';
const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdTokenAddress = '0xc7198437980c041c805A1EDcbA50c1Ce5db95118';
const ethTokenAddress = '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB';
const btcTokenAddress = '0x50b7545627a5162F82A992c33b87aDc75187B218';

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function symbol() public view returns (string)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function transfer(address dst, uint wad) public returns (bool)'
]

const wavaxAbi = [
  'function deposit() public payable',
  ...erc20ABI
]

const POOL_ASSETS = ['AVAX', 'USDT', 'ETH'];

const TEST_TABLE =  [
  {
    id: 1,
    fundInUsd: {
      AVAX: 100,
      USDT: 0,
      ETH: 0,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      AVAX: 550,
      USDT: 0,
      ETH: 0
    },
    targetLtv: 4.1,
    action: 'LIQUIDATE'
  },
  {
    id: 2,
    fundInUsd: {
      AVAX: 100,
      USDT: 0,
      ETH: 0,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      AVAX: 500,
      USDT: 0,
      ETH: 0
    },
    swaps: [
      { from: 'AVAX', to: 'USDT', all: true, amountInUsd: null }
    ],
    targetLtv: 4.5,
    action: 'LIQUIDATE'
  },
  {
    id: 3,
    fundInUsd: {
      AVAX: 0,
      USDT: 0,
      ETH: 50,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      AVAX: 0,
      USDT: 200,
      ETH: 200
    },
    swaps: [
      { from: 'USDT', to: 'BTC', amountInUsd: null, all: true },
      { from: 'ETH', to: 'LINK', amountInUsd: null, all: true }
    ],
    targetLtv: 4.3,
    action: 'LIQUIDATE'
  },
  {
    id: 4,
    fundInUsd: {
      AVAX: 0,
      USDT: 0,
      ETH: 20,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      AVAX: 0,
      USDT: 300,
      ETH: 280
    },
    swaps: [
      { from: 'USDT', to: 'AVAX', amountInUsd: 200, all: false },
      { from: 'USDT', to: 'BTC', amountInUsd: 90, all: false },
      { from: 'ETH', to: 'LINK', amountInUsd: 200, all: false },
      { from: 'ETH', to: 'AVAX', amountInUsd: 90, all: false }
    ],
    targetLtv: 4.4,
    action: 'LIQUIDATE'
  },
  {
    id: 5,
    fundInUsd: {
      AVAX: 100,
      USDT: 0,
      ETH: 0,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      AVAX: 550,
      USDT: 0,
      ETH: 0
    },
    stakeInUsd: {
      YAK: 640
    },
    targetLtv: 4.4,
    action: 'LIQUIDATE'
  },
  {
    id: 6,
    fundInUsd: {
      AVAX: 0,
      USDT: 0,
      ETH: 0,
      BTC: 0,
      LINK: 20
    },
    borrowInUsd: {
      AVAX: 0,
      USDT: 350,
      ETH: 350
    },
    swaps: [
      { from: 'USDT', to: 'AVAX', all: true, amountInUsd: null },
      { from: 'ETH', to: 'AVAX', all: true, amountInUsd: null },
    ],
    stakeInUsd: {
      YAK: 690
    },
    targetLtv: 4.6,
    action: 'LIQUIDATE'
  },
  {
    id: 7,
    fundInUsd: {
      AVAX: 0,
      USDT: 0,
      ETH: 0,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      USDT: 300,
      AVAX: 0,
      ETH: 0
    },
    withdrawInUsd: {
      USDT: 50
    },
    targetLtv: 4.6,
    action: 'HEAL'
  },
  {
    id: 8,
    fundInUsd: {
      AVAX: 0,
      USDT: 0,
      ETH: 0,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      USDT: 300,
      AVAX: 0,
      ETH: 0
    },
    withdrawInUsd: {
      USDT: 50
    },
    targetLtv: 0,
    action: 'CLOSE'
  }
]

describe('Smart loan - real prices',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('An insolvent loan', () => {
    let exchange: PangolinExchange,
        loan: Contract,
        wrappedLoan: any,
        owner: SignerWithAddress,
        borrower: SignerWithAddress,
        depositor: SignerWithAddress,
        loanAddress: string,
        loanFactory: ContractFactory,
        usdPool: ERC20Pool,
        ethPool: ERC20Pool,
        wavaxPool: ERC20Pool,
        ltvLib: LTVLib,
        admin: SignerWithAddress,
        liquidator: SignerWithAddress,
        usdTokenContract: Contract,
        linkTokenContract: Contract,
        ethTokenContract: Contract,
        wavaxTokenContract: Contract,
        yakRouterContract: Contract,
        btcTokenContract: Contract,
        smartLoansFactory: SmartLoansFactory,
        supportedAssets: Array<Asset>,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        LINK_PRICE: number,
        USD_PRICE: number,
        ETH_PRICE: number,
        BTC_PRICE: number,
        diamondAddress: any;

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

      supportedAssets = [
        new Asset(toBytes32('AVAX'), wavaxTokenAddress),
        new Asset(toBytes32('USDT'), usdTokenAddress),
        new Asset(toBytes32('LINK'), linkTokenAddress),
        new Asset(toBytes32('ETH'), ethTokenAddress),
        new Asset(toBytes32('BTC'), btcTokenAddress)
      ];

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, supportedAssets);

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

      AVAX_PRICE = (await redstone.getPrice('AVAX', { provider: "redstone-avalanche"})).value;
      USD_PRICE = (await redstone.getPrice('USDT', { provider: "redstone-avalanche"})).value;
      LINK_PRICE = (await redstone.getPrice('LINK', { provider: "redstone-avalanche"})).value;
      ETH_PRICE = (await redstone.getPrice('ETH', { provider: "redstone-avalanche"})).value;
      BTC_PRICE = (await redstone.getPrice('BTC', { provider: "redstone-avalanche"})).value;

      //TODO: why do we mock prices? maybe we can use wrapLite?
      MOCK_PRICES = [
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        },
        {
          symbol: 'USDT',
          value: USD_PRICE
        },
        {
          symbol: 'LINK',
          value: LINK_PRICE
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
      await depositToPool("USDT", usdTokenContract, usdPool, 10000, USD_PRICE);
      await depositToPool("ETH", ethTokenContract, ethPool, 1, ETH_PRICE);

      await topupUser(liquidator);
      await topupUser(borrower);

      await recompileSmartLoanLib(
          "SmartLoanLib",
          [0, 1, 3],
          [wavaxTokenAddress, usdTokenAddress, ethTokenAddress],
          {'AVAX': wavaxPool.address, 'USDT': usdPool.address, 'ETH': ethPool.address},
          exchange.address,
          yakRouterContract.address,
          'lib'
      );

      // Deploy LTVLib and later link contracts to it
      const LTVLib = await ethers.getContractFactory('LTVLib');
      ltvLib = await LTVLib.deploy() as LTVLib;

      async function depositToPool(symbol: string, tokenContract: Contract, pool: ERC20Pool, amount: number, price: number) {
        const initialTokenDepositWei = parseUnits(amount.toString(), await tokenContract.decimals());
        let requiredAvax = toWei((amount * price * 1.5 / AVAX_PRICE).toString());

        await wavaxTokenContract.connect(depositor).deposit({value: requiredAvax});
        await wavaxTokenContract.connect(depositor).transfer(exchange.address, requiredAvax);
        await exchange.connect(depositor).swap(toBytes32("AVAX"), toBytes32(symbol), requiredAvax, initialTokenDepositWei);

        await tokenContract.connect(depositor).approve(pool.address, initialTokenDepositWei);
        await pool.connect(depositor).deposit(initialTokenDepositWei);
      }

      async function topupUser(user: SignerWithAddress) {
        await wavaxTokenContract.connect(user).deposit({ value: toWei((10 * 10000 / AVAX_PRICE).toString()) });

        const amountSwapped = toWei((10000 / AVAX_PRICE).toString());

        await wavaxTokenContract.connect(user).transfer(exchange.address, amountSwapped);
        await exchange.connect(user).swap(toBytes32("AVAX"), toBytes32("USDT"), amountSwapped, 0);

        await wavaxTokenContract.connect(user).transfer(exchange.address, amountSwapped);
        await exchange.connect(user).swap(toBytes32("AVAX"), toBytes32("ETH"), amountSwapped, 0);

        await wavaxTokenContract.connect(user).transfer(exchange.address, amountSwapped);
        await exchange.connect(user).swap(toBytes32("AVAX"), toBytes32("BTC"), amountSwapped, 0);

        await wavaxTokenContract.connect(user).transfer(exchange.address, amountSwapped);
        await exchange.connect(user).swap(toBytes32("AVAX"), toBytes32("LINK"), amountSwapped, 0);
      }
    });

    before("prepare smart loan facets", async () => {

      await deployFacet("MockSmartLoanLogicFacetAlwaysSolventRedstoneProvider", diamondAddress, [], ltvLib.address);
      await deployFacet("MockSmartLoanLiquidationFacetRedstoneProvider", diamondAddress, ["liquidateLoan", "unsafeLiquidateLoan", "closeLoan"], ltvLib.address);
    });

    beforeEach("create a loan", async () => {
      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      await replaceFacet("MockSmartLoanLogicFacetAlwaysSolventRedstoneProvider", diamondAddress, [], ltvLib.address)

      await smartLoansFactory.initialize(diamondAddress);

      await smartLoansFactory.connect(borrower).createLoan();

      loanAddress = await smartLoansFactory.getLoanForOwner(borrower.address);

      loanFactory = await ethers.getContractFactory("MockSmartLoanLogicFacetRedstoneProvider", {
        libraries: {
          LTVLib: ltvLib.address
        }
      });

      //TODO: we don't cast to MockSmartLoanRedstoneProvider to have access to all the methods (not just ones from a logic facet)
      loan = await loanFactory.attach(loanAddress).connect(borrower) as MockSmartLoanLogicFacetRedstoneProvider;

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


      TEST_TABLE.forEach(
      async testCase => {
        it(`Testcase ${testCase.id}:\n
        fund AVAX: ${testCase.fundInUsd.AVAX}, USDT: ${testCase.fundInUsd.USDT}, ETH: ${testCase.fundInUsd.ETH}, BTC: ${testCase.fundInUsd.BTC}, LINK: ${testCase.fundInUsd.LINK}\n
        borrow AVAX: ${testCase.borrowInUsd.AVAX}, USDT: ${testCase.borrowInUsd.USDT}, ETH: ${testCase.borrowInUsd.ETH}`,
        async () => {
          //fund
          for (const [symbol, value] of Object.entries(testCase.fundInUsd)) {
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
              let amountOfTokens = value / getPrice(symbol)!;

              await wrappedLoan.fund(toBytes32(symbol), toWei(amountOfTokens.toString(), tokenDecimals));
            }
          }

          for (const [symbol, value] of Object.entries(testCase.borrowInUsd)) {
            if (value > 0) {
              let contract = getTokenContract(symbol)!;
              let decimals = await contract.decimals();
              let amountOfTokens = value / getPrice(symbol)!;

              await wrappedLoan.borrow(toBytes32(symbol), toWei(amountOfTokens.toFixed(decimals) ?? 0, decimals));
            }
          }

          if (testCase.withdrawInUsd) {
            for (const [symbol, value] of Object.entries(testCase.withdrawInUsd)) {
              if (value > 0) {
                let contract = getTokenContract(symbol)!;
                let decimals = await contract.decimals();
                let amountOfTokens = value / getPrice(symbol)!;

                await wrappedLoan.withdraw(toBytes32(symbol), toWei(amountOfTokens.toFixed(decimals) ?? 0, decimals));
              }
            }
          }

          if (testCase.swaps) {
            for (const swap of testCase.swaps) {
              let contract = getTokenContract(swap.from)!;
              let tokenDecimals = await contract.decimals();
              if (swap.all) {
                await wrappedLoan.swap(toBytes32(swap.from), toBytes32(swap.to), await wrappedLoan.getBalance(toBytes32(swap.from)), 0);
              } else if (swap.amountInUsd) {
                let amountOfTokens = 0.99 * swap.amountInUsd / getPrice(swap.from)!;
                await wrappedLoan.swap(toBytes32(swap.from), toBytes32(swap.to), toWei(amountOfTokens.toFixed(tokenDecimals), tokenDecimals), 0);
              }
            }
          }

          // if (testCase.stakeInUsd) {
          //   //YAK AVAX
          //   let amountOfTokens = testCase.stakeInUsd.YAK / getPrice("AVAX")!;
          //   await wrappedLoan.stakeAVAXYak(toWei(amountOfTokens.toString()));
          // }

          let maxBonus = 0.05;

          const bonus = calculateBonus(
              testCase.action,
              fromWei(await wrappedLoan.getDebt()),
              fromWei(await wrappedLoan.getTotalValue()),
              testCase.targetLtv,
              maxBonus
          );

          const neededToRepay = toRepay(
            testCase.action,
            fromWei(await wrappedLoan.getDebt()),
            fromWei(await wrappedLoan.getTotalValue()),
            testCase.targetLtv,
            bonus
          )

          const balances = [];

          for (const [i, balance] of (await wrappedLoan.getAllAssetsBalances()).entries()) {
            balances.push(
                formatUnits(balance, await getTokenContract(fromBytes32((await exchange.getAllAssets())[i]))!.decimals())
            );
          }

          const debts = [];

          for (const [index, debt] of (await wrappedLoan.getDebts()).entries()) {
            debts.push(formatUnits(debt, await getTokenContract(POOL_ASSETS[index])!.decimals()))
          }

          const repayAmounts = getRepayAmounts(
              debts,
              await wrappedLoan.getPoolsAssetsIndices(),
              neededToRepay,
              MOCK_PRICES.map((el: any) => el.value)
          );

          let loanIsBankrupt = await wrappedLoan.getTotalValue() < await wrappedLoan.getDebt();

          let allowanceAmounts;

          if (!loanIsBankrupt) {
            allowanceAmounts = toSupply(
                await wrappedLoan.getPoolsAssetsIndices(),
                balances,
                repayAmounts
            );
          } else {
            allowanceAmounts = repayAmounts;
          }

          await action(testCase.action, allowanceAmounts, repayAmounts, bonus);

          expect((await wrappedLoan.getLTV()).toNumber() / 1000).to.be.closeTo(testCase.targetLtv, 0.01);
        });
      }
   );


    async function action(
        performedAction: string,
        allowanceAmounts: Array<number>,
        repayAmounts: Array<number>,
        bonus: number
    ) {

      const loanFactoryLiquidation = await ethers.getContractFactory("MockSmartLoanLiquidationFacetRedstoneProvider", {
        libraries: {
          LTVLib: ltvLib.address
        }
      });

      await replaceFacet("MockSmartLoanLogicFacetRedstoneProvider", diamondAddress, [], ltvLib.address);

      const performer = performedAction === 'CLOSE' ? borrower : liquidator;

      loan = await loanFactoryLiquidation.attach(loanAddress).connect(performer) as MockSmartLoanLiquidationFacetRedstoneProvider;

      wrappedLoan = WrapperBuilder
          .mockLite(loan)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })

      expect(await wrappedLoan.isSolvent()).to.be.false;

      let repayAmountsInWei = await Promise.all(repayAmounts.map(
          async (amount, i) => {
            let decimals = await getTokenContract(POOL_ASSETS[i])!.decimals();
            return parseUnits((amount.toFixed(decimals) ?? 0).toString(), decimals);
          }
      ));

      let allowanceAmountsInWei = await Promise.all(allowanceAmounts.map(
          async (amount, i) => {
            let token = await getTokenContract(POOL_ASSETS[i])!;
            let decimals = await token.decimals();

            let allowance = parseUnits((amount.toFixed(decimals) ?? 0).toString(), decimals);
            await token.connect(performer).approve(wrappedLoan.address, allowance);
            return allowance;
          }
      ));

      const bonusInWei = (bonus * 1000).toFixed(0);

      switch (performedAction) {
        case 'LIQUIDATE':
          await wrappedLoan.liquidateLoan(repayAmountsInWei, bonusInWei);
          break;
        case 'HEAL':
          await wrappedLoan.unsafeLiquidateLoan(repayAmountsInWei, bonusInWei);
          break;
        case 'CLOSE':
          await wrappedLoan.closeLoan(allowanceAmountsInWei);
          break;
      }

      expect(await wrappedLoan.isSolvent()).to.be.true;
    }

    function getTokenContract(symbol: string) {
      if (symbol == "AVAX") return wavaxTokenContract;
      if (symbol == "USDT") return usdTokenContract;
      if (symbol == "ETH") return ethTokenContract;
      if (symbol == "LINK") return linkTokenContract;
      if (symbol == "BTC") return btcTokenContract;
    }

    function getPrice(symbol: string) {
      if (symbol == "AVAX") return AVAX_PRICE;
      if (symbol == "USDT") return USD_PRICE;
      if (symbol == "ETH") return ETH_PRICE;
      if (symbol == "LINK") return LINK_PRICE;
      if (symbol == "BTC") return BTC_PRICE;
    }
  });
});

