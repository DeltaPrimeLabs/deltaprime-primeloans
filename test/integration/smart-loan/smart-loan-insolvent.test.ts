import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import VariableUtilisationRatesCalculatorArtifact
  from '../../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import ERC20PoolArtifact from '../../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockSmartLoanArtifact from '../../../artifacts/contracts/mock/MockSmartLoan.sol/MockSmartLoan.json';
import UpgradeableBeaconArtifact
  from '../../../artifacts/@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol/UpgradeableBeacon.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  Asset,
  deployAndInitPangolinExchangeContract, fromWei,
  getFixedGasSigners, getAvailableToRepay,
  recompileSmartLoan, suppliedAmounts,
  toBytes32,
  toWei, toRepay, getRepayAmounts, formatUnits, fromBytes32,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
  CompoundingIndex,
  ERC20Pool,
  MockSmartLoanRedstoneProvider,
  OpenBorrowersRegistry__factory,
  PangolinExchange,
  SmartLoan,
  SmartLoansFactory,
  UpgradeableBeacon,
  VariableUtilisationRatesCalculator, YieldYakRouter__factory
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";

chai.use(solidity);

const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const linkTokenAddress = '0x5947bb275c521040051d82396192181b413227a3';
const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdTokenAddress = '0xc7198437980c041c805a1edcba50c1ce5db95118';
const ethTokenAddress = '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB';
const btcTokenAddress = '0x50b7545627a5162F82A992c33b87aDc75187B218';

const SMART_LOAN = "MockSmartLoanRedstoneProvider";
const SMART_LOAN_ALWAYS_SOLVENT = "MockSmartLoanAlwaysSolvent";
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

const POOL_ASSETS = ['AVAX', 'USD', 'ETH'];

const TEST_TABLE =  [
  {
    id: 1,
    fundInUsd: {
      AVAX: 100,
      USD: 0,
      ETH: 0,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      AVAX: 550,
      USD: 0,
      ETH: 0
    },
    suppliedAssets: [
      { symbol: 'AVAX', proportion: 1}
    ],
    repayAssetsProportions: [
      { symbol: 'AVAX', proportion: 1}
    ],
    targetLtv: 4.1,
    action: 'LIQUIDATE'
  },
  {
    id: 2,
    fundInUsd: {
      AVAX: 100,
      USD: 0,
      ETH: 0,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      AVAX: 500,
      USD: 0,
      ETH: 0
    },
    swaps: [
      { from: 'AVAX', to: 'USD', all: true, amountInUsd: null }
    ],
    suppliedAssets: [
      { symbol: 'AVAX', proportion: 1}
    ],
    repayAssetsProportions: [
      { symbol: 'AVAX', proportion: 1}
    ],
    targetLtv: 4.5,
    action: 'LIQUIDATE'
  },
  {
    id: 3,
    fundInUsd: {
      AVAX: 0,
      USD: 0,
      ETH: 50,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      AVAX: 0,
      USD: 200,
      ETH: 200
    },
    swaps: [
      { from: 'USD', to: 'BTC', amountInUsd: null, all: true },
      { from: 'ETH', to: 'LINK', amountInUsd: null, all: true }
    ],
    suppliedAssets: [
      { symbol: 'ETH', proportion: 50 },
      { symbol: 'USD', proportion: 50 }
    ],
    repayAssetsProportions: [
      { symbol: 'ETH', proportion: 50 },
      { symbol: 'USD', proportion: 50 }
    ],
    targetLtv: 4.3,
    action: 'LIQUIDATE'
  },
  {
    id: 4,
    fundInUsd: {
      AVAX: 100,
      USD: 0,
      ETH: 0,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      AVAX: 550,
      USD: 0,
      ETH: 0
    },
    stakeInUsd: {
      YAK: 640
    },
    suppliedAssets: [
      { symbol: 'AVAX', proportion: 1 }
    ],
    repayAssetsProportions: [
      { symbol: 'AVAX', proportion: 1 }
    ],
    targetLtv: 4.4,
    action: 'LIQUIDATE'
  },
  {
    id: 5,
    fundInUsd: {
      AVAX: 0,
      USD: 0,
      ETH: 0,
      BTC: 0,
      LINK: 50
    },
    borrowInUsd: {
      USD: 350,
      ETH: 350
    },
    swaps: [
      { from: 'USD', to: 'AVAX', all: true, amountInUsd: null },
      { from: 'ETH', to: 'AVAX', all: true, amountInUsd: null },
    ],
    stakeInUsd: {
      YAK: 690
    },
    suppliedAssets: [
      { symbol: 'USD', proportion: 1 },
      { symbol: 'ETH', proportion: 1 }
    ],
    repayAssetsProportions: [
      { symbol: 'USD', proportion: 1 },
      { symbol: 'ETH', proportion: 1 }
    ],
    targetLtv: 4.6,
    action: 'LIQUIDATE'
  },
  {
    id: 6,
    fundInUsd: {
      AVAX: 0,
      USD: 0,
      ETH: 0,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      USD: 300,
      AVAX: 0,
      ETH: 0
    },
    withdrawInUsd: {
      USD: 50
    },
    suppliedAssets: [
      { symbol: 'USD', proportion: 1 },
    ],
    repayAssetsProportions: [
    ],
    targetLtv: 4.6,
    action: 'HEAL'
  },
  {
    id: 7,
    fundInUsd: {
      AVAX: 0,
      USD: 0,
      ETH: 0,
      BTC: 0,
      LINK: 0
    },
    borrowInUsd: {
      USD: 300,
      AVAX: 0,
      ETH: 0
    },
    withdrawInUsd: {
      USD: 50
    },
    suppliedAssets: [
      { symbol: 'USD', proportion: 1 },
    ],
    repayAssetsProportions: [
    ],
    targetLtv: 0,
    action: 'CLOSE'
  }
]

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('An insolvent loan', () => {
    let exchange: PangolinExchange,
        loan: SmartLoan,
        wrappedLoan: any,
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
        beacon: UpgradeableBeacon,
        smartLoansFactory: SmartLoansFactory,
        implementation: SmartLoan,
        newImplementation: SmartLoan,
        supportedAssets: Array<Asset>,
        artifact: any,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        LINK_PRICE: number,
        USD_PRICE: number,
        ETH_PRICE: number,
        BTC_PRICE: number;

    before("deploy provider, exchange and pool", async () => {
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
        new Asset(toBytes32('USD'), usdTokenAddress),
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

      await topupLiquidator();

      async function depositToPool(symbol: string, tokenContract: Contract, pool: ERC20Pool, amount: number, price: number) {
        const initialTokenDepositWei = parseUnits(amount.toString(), await tokenContract.decimals());
        let requiredAvax = toWei((amount * price * 1.5 / AVAX_PRICE).toString());

        await wavaxTokenContract.connect(depositor).deposit({value: requiredAvax});
        await wavaxTokenContract.connect(depositor).transfer(exchange.address, requiredAvax);
        await exchange.connect(depositor).swap(toBytes32("AVAX"), toBytes32(symbol), requiredAvax, initialTokenDepositWei);

        await tokenContract.connect(depositor).approve(pool.address, initialTokenDepositWei);
        await pool.connect(depositor).deposit(initialTokenDepositWei);
      }

      async function topupLiquidator() {
        await wavaxTokenContract.connect(liquidator).deposit({ value: toWei((10 * 10000 / AVAX_PRICE).toString()) });

        const amountSwapped = toWei((10000 / AVAX_PRICE).toString());

        await wavaxTokenContract.connect(liquidator).transfer(exchange.address, amountSwapped);
        await exchange.connect(liquidator).swap(toBytes32("AVAX"), toBytes32("USD"), amountSwapped, 0);

        await wavaxTokenContract.connect(liquidator).transfer(exchange.address, amountSwapped);
        await exchange.connect(liquidator).swap(toBytes32("AVAX"), toBytes32("ETH"), amountSwapped, 0);

        await wavaxTokenContract.connect(liquidator).transfer(exchange.address, amountSwapped);
        await exchange.connect(liquidator).swap(toBytes32("AVAX"), toBytes32("BTC"), amountSwapped, 0);

        await wavaxTokenContract.connect(liquidator).transfer(exchange.address, amountSwapped);
        await exchange.connect(liquidator).swap(toBytes32("AVAX"), toBytes32("LINK"), amountSwapped, 0);
      }
    });

    before("prepare smart loan implementations", async () => {
      artifact = await recompileSmartLoan(SMART_LOAN_ALWAYS_SOLVENT, [0, 1, 3], {'AVAX': wavaxPool.address, 'USD': usdPool.address, 'ETH': ethPool.address},  exchange.address, yakRouterContract.address, 'mock');
      implementation = await deployContract(owner, artifact) as SmartLoan;

      artifact = await recompileSmartLoan(SMART_LOAN,[0, 1, 3], { 'AVAX': wavaxPool.address, 'USD': usdPool.address, 'ETH': ethPool.address}, exchange.address, yakRouterContract.address, 'mock');
      newImplementation = await deployContract(owner, artifact) as SmartLoan;
    });

    beforeEach("create a loan", async () => {
      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(implementation.address);

      const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
      beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);

      await smartLoansFactory.connect(borrower).createLoan();

      const loanAddress = await smartLoansFactory.getLoanForOwner(borrower.address);
      loan = ((await new ethers.Contract(loanAddress, MockSmartLoanArtifact.abi)) as MockSmartLoanRedstoneProvider).connect(borrower);

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
        fund AVAX: ${testCase.fundInUsd.AVAX}, USD: ${testCase.fundInUsd.USD}, ETH: ${testCase.fundInUsd.ETH}, BTC: ${testCase.fundInUsd.BTC}, LINK: ${testCase.fundInUsd.LINK}\n
        borrow AVAX: ${testCase.borrowInUsd.AVAX}, USD: ${testCase.borrowInUsd.USD}, ETH: ${testCase.borrowInUsd.ETH}`,
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

          if (testCase.stakeInUsd) {
            //YAK AVAX
            let amountOfTokens = testCase.stakeInUsd.YAK / getPrice("AVAX")!;
            await wrappedLoan.stakeAVAXYak(toWei(amountOfTokens.toString()));
          }

          let bonus = 0.05;

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

          let neededToSupply = 0;
          let availableToRepay = getAvailableToRepay(
              balances,
              (await wrappedLoan.getAllAssetsPrices()).map((el: BigNumber) => el.toNumber()),
              debts,
              await wrappedLoan.getPoolsAssetsIndices()
          );

          switch (testCase.action) {
            case 'LIQUIDATE':
              neededToSupply = Math.max(1.00001 * (neededToRepay - availableToRepay), 0);
              break;
            case 'HEAL':
              neededToSupply = neededToRepay;
              break;
            case 'CLOSE':
              neededToSupply = Math.max(1.00001 * (neededToRepay - availableToRepay), 0);
              break;
          }

          const repayAmounts = getRepayAmounts(
            testCase.repayAssetsProportions,
            neededToRepay,
            MOCK_PRICES
          );

          const allowanceAmounts = suppliedAmounts(
            testCase.suppliedAssets,
            neededToSupply,
            MOCK_PRICES,
          );

          await action(testCase.action, allowanceAmounts, repayAmounts);

          expect((await wrappedLoan.getLTV()).toNumber() / 1000).to.be.closeTo(testCase.targetLtv, 0.01);
        });
      }
   );


    async function action(
        performedAction: string,
        allowanceAmounts: Array<{symbol: string, toSupply: number}>,
        repayAmounts: Array<{symbol: string, toRepay: number}>
        ) {
      await beacon.connect(owner).upgradeTo(newImplementation.address);

      expect(await wrappedLoan.isSolvent()).to.be.false;

      const performer = performedAction === 'CLOSE' ? borrower : liquidator;
      loan = ((await new ethers.Contract(await smartLoansFactory.getLoanForOwner(borrower.address), MockSmartLoanArtifact.abi)) as MockSmartLoanRedstoneProvider).connect(performer);

      wrappedLoan = WrapperBuilder
          .mockLite(loan)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })

      //approves allowance amounts and returns an array of allowances in Wei
      async function prepareAllowanceAmounts(allowances: Array<{symbol: string, toSupply: number}>) {
        const pools = ['AVAX', 'USD', 'ETH'];

        const allowancesInWei = new Array(pools.length).fill(0);
        for (const allowance of allowances) {
          const token = getTokenContract(allowance.symbol)!;
          let decimals = await token.decimals();
          const amountInWei = parseUnits(allowance.toSupply.toFixed(decimals) ?? 0, decimals);
          let index = pools.findIndex(asset => asset === allowance.symbol)
          allowancesInWei[index] = amountInWei;
          await token.connect(performer).approve(wrappedLoan.address, amountInWei);
        }

        return allowancesInWei;
      }

      async function prepareRepayAmounts(repayAmounts: Array<{symbol: string, toRepay: number}>) {
        const pools = ['AVAX', 'USD', 'ETH'];

        const amounts = [];
        for (const pool of pools) {
          let decimals = await getTokenContract(pool)!.decimals();
          amounts.push(parseUnits((repayAmounts.find(el=> el.symbol == pool)?.toRepay.toFixed(decimals) ?? 0).toString(), decimals));
        }

        return amounts;
      }

      const allowances = await prepareAllowanceAmounts(allowanceAmounts);

      switch (performedAction) {
        case 'LIQUIDATE':
          await wrappedLoan.liquidateLoan(await prepareRepayAmounts(repayAmounts));
          break;
        case 'HEAL':
          await wrappedLoan.healBankruptLoan(allowances);
          break;
        case 'CLOSE':
          await wrappedLoan.closeLoan(allowances);
          break;
      }

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

