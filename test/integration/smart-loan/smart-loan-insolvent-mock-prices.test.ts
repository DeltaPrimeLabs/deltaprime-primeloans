import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

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
  recompileSmartLoan,
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
  MockSmartLoanRedstoneProvider,
  OpenBorrowersRegistry__factory,
  PangolinExchange,
  SmartLoan,
  SmartLoansFactory,
  VariableUtilisationRatesCalculator,
  YieldYakRouter__factory
} from "../../../typechain";
import {Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";

chai.use(solidity);

const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdTokenAddress = '0xc7198437980c041c805A1EDcbA50c1Ce5db95118';
const ethTokenAddress = '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB';
const btcTokenAddress = '0x50b7545627a5162F82A992c33b87aDc75187B218';

const SMART_LOAN = "MockSmartLoanRedstoneProvider";
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

const INITIAL_PRICES = {
  AVAX: 30,
  USD: 1,
  ETH: 2000,
  BTC: 30000
}

const TEST_TABLE =  [
  {
    id: 1,
    fund: {
      AVAX: 10, // worth 300 USD
      USD: 0,
      ETH: 0,
      BTC: 0
    },
    borrow: {
      AVAX: 0,
      USD: 1200, // LTV 400%
      ETH: 0
    },
    pricesDuringLiquidation: {
      AVAX: 20// changed from 30
      // LTV 600%
    },
    targetLtv: 4.1,
    action: 'LIQUIDATE'
  },
  {
    id: 2,
    fund: {
      AVAX: 0,
      USD: 0,
      ETH: 0,
      BTC: 0.01 //USD = 300
    },
    borrow: {
      AVAX: 5, //USD = 150
      USD: 150,
      ETH: 0.1 //USD = 200
    },
    pricesDuringLiquidation: {
      BTC: 10000// changed from 2000
      // LTV 500%
    },
    targetLtv: 4.5,
    action: 'LIQUIDATE'
  },
  {
    id: 3,
    fund: {
      AVAX: 0,
      USD: 0,
      ETH: 0.1, //USD = 200
      BTC: 0
    },
    borrow: {
      AVAX: 10,
      USD: 0,
      ETH: 0
    },
    stake: {
      YAK: 9.5
    },
    pricesDuringLiquidation: {
      ETH: 500// changed from 2000
      // LTV 600%
    },
    targetLtv: 4.4,
    action: 'LIQUIDATE'
  },
  {
    id: 4,
    fund: {
      AVAX: 0,
      USD: 300,
      ETH: 0,
      BTC: 0
    },
    borrow: {
      AVAX: 40, //USD = 1200
      USD: 0,
      ETH: 0
    },
    pricesDuringLiquidation: {
      USD: 0.000001// changed from 1
      //Black swan event
    },
    targetLtv: 4.5,
    //needs more margin because of accumulation of interest when repaying the loan (affects debt and final LTV)
    ltvPrecision: 0.15,
    action: 'LIQUIDATE'
  }
]

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('An insolvent loan - mock prices', () => {
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
        ethTokenContract: Contract,
        wavaxTokenContract: Contract,
        yakRouterContract: Contract,
        btcTokenContract: Contract,
        smartLoansFactory: SmartLoansFactory,
        implementation: SmartLoan,
        supportedAssets: Array<Asset>,
        artifact: any,
        INITIAL_MOCK_PRICES: any;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor, borrower, admin, liquidator] = await getFixedGasSigners(10000000);

      usdPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
      wavaxPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
      ethPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;

      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      ethTokenContract = new ethers.Contract(ethTokenAddress, erc20ABI, provider);
      btcTokenContract = new ethers.Contract(btcTokenAddress, erc20ABI, provider);
      wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider);

      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

      supportedAssets = [
        new Asset(toBytes32('AVAX'), wavaxTokenAddress),
        new Asset(toBytes32('USD'), usdTokenAddress),
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

      INITIAL_MOCK_PRICES = [
        {
          symbol: 'AVAX',
          value: INITIAL_PRICES.AVAX
        },
        {
          symbol: 'USD',
          value: INITIAL_PRICES.USD
        },
        {
          symbol: 'ETH',
          value: INITIAL_PRICES.ETH
        },
        {
          symbol: 'BTC',
          value: INITIAL_PRICES.BTC
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
      await depositToPool("USD", usdTokenContract, usdPool, 10000, INITIAL_PRICES.USD);
      await depositToPool("ETH", ethTokenContract, ethPool, 1, INITIAL_PRICES.ETH);

      await topupUser(liquidator);
      await topupUser(borrower);

      async function depositToPool(symbol: string, tokenContract: Contract, pool: ERC20Pool, amount: number, price: number) {
        const initialTokenDepositWei = parseUnits(amount.toString(), await tokenContract.decimals());
        let requiredAvax = toWei((amount * price * 1.5 / INITIAL_PRICES.AVAX).toString());

        await wavaxTokenContract.connect(depositor).deposit({value: requiredAvax});
        await wavaxTokenContract.connect(depositor).transfer(exchange.address, requiredAvax);
        await exchange.connect(depositor).swap(toBytes32("AVAX"), toBytes32(symbol), requiredAvax, initialTokenDepositWei);

        await tokenContract.connect(depositor).approve(pool.address, initialTokenDepositWei);
        await pool.connect(depositor).deposit(initialTokenDepositWei);
      }

      async function topupUser(user: SignerWithAddress) {
        await wavaxTokenContract.connect(user).deposit({ value: toWei((10 * 10000 / INITIAL_PRICES.AVAX).toString()) });

        const amountSwapped = toWei((10000 / INITIAL_PRICES.AVAX).toString());

        await wavaxTokenContract.connect(user).transfer(exchange.address, amountSwapped);
        await exchange.connect(user).swap(toBytes32("AVAX"), toBytes32("USD"), amountSwapped, 0);

        await wavaxTokenContract.connect(user).transfer(exchange.address, amountSwapped);
        await exchange.connect(user).swap(toBytes32("AVAX"), toBytes32("ETH"), amountSwapped, 0);

        await wavaxTokenContract.connect(user).transfer(exchange.address, amountSwapped);
        await exchange.connect(user).swap(toBytes32("AVAX"), toBytes32("BTC"), amountSwapped, 0);
      }
    });

    before("prepare smart loan implementations", async () => {
      artifact = await recompileSmartLoan(
          SMART_LOAN,
          [0, 1, 2],
          [wavaxTokenAddress, usdTokenAddress, ethTokenAddress],
          { 'AVAX': wavaxPool.address, 'USD': usdPool.address, 'ETH': ethPool.address}, exchange.address, yakRouterContract.address,
          'mock'
      );
      implementation = await deployContract(owner, artifact) as SmartLoan;
    });

    beforeEach("create a loan", async () => {
      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(implementation.address);

      await smartLoansFactory.connect(borrower).createLoan();

      const loanAddress = await smartLoansFactory.getLoanForOwner(borrower.address);

      let SmartLoanArtifact = await import('../../../artifacts/contracts/SmartLoan.sol/SmartLoan.json');

      loan = ((await new ethers.Contract(loanAddress, SmartLoanArtifact.abi)) as MockSmartLoanRedstoneProvider).connect(borrower);

      wrappedLoan = WrapperBuilder
        .mockLite(loan)
        .using(
          () => {
            return {
              prices: INITIAL_MOCK_PRICES,
              timestamp: Date.now()
            }
          })
    });

      TEST_TABLE.forEach(
      async testCase => {
        it(`Testcase ${testCase.id}:\n
        fund AVAX: ${testCase.fund.AVAX}, USD: ${testCase.fund.USD}, ETH: ${testCase.fund.ETH}, BTC: ${testCase.fund.BTC}\n
        borrow AVAX: ${testCase.borrow.AVAX}, USD: ${testCase.borrow.USD}, ETH: ${testCase.borrow.ETH}`,
        async () => {
          //fund
          for (const [symbol, value] of Object.entries(testCase.fund)) {
            if (value > 0) {
              let contract = getTokenContract(symbol)!;
              let tokenDecimals = await contract.decimals();

              let requiredAvax = toWei((value * getPrice(symbol)! * 1.5 / INITIAL_PRICES.AVAX).toString());
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
              let decimals = await contract.decimals();

              await wrappedLoan.borrow(toBytes32(symbol), toWei(value.toFixed(decimals) ?? 0, decimals));
            }
          }

          if (testCase.stake) {
            //YAK AVAX
            await wrappedLoan.stakeAVAXYak(toWei(testCase.stake.YAK.toString()));
          }

          const performer = testCase.action === 'CLOSE' ? borrower : liquidator;
          let SmartLoanArtifact = await import('../../../artifacts/contracts/mock/MockSmartLoanAlwaysSolvent.sol/MockSmartLoanAlwaysSolvent.json');
          loan = ((await new ethers.Contract(await smartLoansFactory.getLoanForOwner(borrower.address), SmartLoanArtifact.abi)) as MockSmartLoanRedstoneProvider).connect(performer);

          let newPrices = INITIAL_MOCK_PRICES.map(
              (asset: any) => {
                // @ts-ignore
                let newPrice = testCase.pricesDuringLiquidation[asset.symbol];

                return {
                  symbol: asset.symbol,
                  value: newPrice ?? asset.value
                };
              }
          )

          wrappedLoan = WrapperBuilder
              .mockLite(loan)
              .using(
                  () => {
                    return {
                      prices: newPrices,
                      timestamp: Date.now()
                    }
                  });

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
              newPrices
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

          await action(wrappedLoan, testCase.action, allowanceAmounts, repayAmounts, bonus);

          expect((await wrappedLoan.getLTV()).toNumber() / 1000).to.be.closeTo(testCase.targetLtv, testCase.ltvPrecision ?? 0.01);
        });
      }
   );


    async function action(
        wrappedLoan: Contract,
        performedAction: string,
        allowanceAmounts: Array<number>,
        repayAmounts: Array<number>,
        bonus: number
        ) {
      expect(await wrappedLoan.isSolvent()).to.be.false;

      const performer = performedAction === 'CLOSE' ? borrower : liquidator;

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
          await wrappedLoan.closeLoan(allowanceAmountsInWei, bonusInWei);
          break;
      }

      expect(await wrappedLoan.isSolvent()).to.be.true;
    }

    function getTokenContract(symbol: string) {
      if (symbol == "AVAX") return wavaxTokenContract;
      if (symbol == "USD") return usdTokenContract;
      if (symbol == "ETH") return ethTokenContract;
      if (symbol == "BTC") return btcTokenContract;
    }

    function getPrice(symbol: string) {
      if (symbol == "AVAX") return INITIAL_PRICES.AVAX;
      if (symbol == "USD") return INITIAL_PRICES.USD;
      if (symbol == "ETH") return INITIAL_PRICES.ETH;
      if (symbol == "BTC") return INITIAL_PRICES.BTC;
    }
  });
});

