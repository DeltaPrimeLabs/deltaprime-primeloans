import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  Asset,
  calculateBonus,
  deployAllFacets, deployAndInitExchangeContract,
  deployAndInitializeLendingPool,
  formatUnits,
  fromBytes32,
  fromWei,
  getFixedGasSigners,
  getRepayAmounts,
  PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toRepay,
  toSupply,
  toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
  Pool,
  PangolinIntermediary,
  TokenManager,
  RedstoneConfigManager__factory,
  SmartLoansFactory, SmartLoanGigaChadInterface,
} from "../../../typechain";
import {Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function transfer(address dst, uint wad) public returns (bool)'
]

const INITIAL_PRICES = {
  AVAX: 15,
  USDC: 1,
  ETH: 1000,
  BTC: 20000,
  YYAV3SA1: 15.2,
}

const TEST_TABLE =  [
  {
    id: 1,
    fund: {
      AVAX: 20,
      USDC: 0,
      ETH: 0,
      BTC: 0
    },
    borrow: {
      AVAX: 0,
      USDC: 1200,
      ETH: 0
    },
    pricesDuringLiquidation: {
      AVAX: 8
    },
    targetLtv: 4.1,
    action: 'LIQUIDATE'
  },
  {
    id: 2,
    fund: {
      AVAX: 0,
      USDC: 0,
      ETH: 0,
      BTC: 0.01
    },
    borrow: {
      AVAX: 10,
      USDC: 150,
      ETH: 0.2
    },
    pricesDuringLiquidation: {
      BTC: 10000
    },
    targetLtv: 4.5,
    action: 'LIQUIDATE'
  },
  {
    id: 3,
    fund: {
      AVAX: 0,
      USDC: 0,
      ETH: 0.1,
      BTC: 0
    },
    borrow: {
      AVAX: 20,
      USDC: 0,
      ETH: 0
    },
    stake: {
      YAK: 18
    },
    pricesDuringLiquidation: {
      ETH: 200
    },
    targetLtv: 4.4,
    action: 'LIQUIDATE'
  },
  {
    id: 4,
    fund: {
      AVAX: 0,
      USDC: 300,
      ETH: 0,
      BTC: 0
    },
    borrow: {
      AVAX: 40,
      USDC: 0,
      ETH: 0
    },
    pricesDuringLiquidation: {
      USDC: 0.000001// changed from 1
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
    let exchange: PangolinIntermediary,
        loan: SmartLoanGigaChadInterface,
        wrappedLoan: any,
        owner: SignerWithAddress,
        borrower: SignerWithAddress,
        depositor: SignerWithAddress,
        admin: SignerWithAddress,
        liquidator: SignerWithAddress,
        smartLoansFactory: SmartLoansFactory,
        tokenContracts: any = {},
        poolContracts: any = {},
        supportedAssets: Array<Asset>,
        INITIAL_MOCK_PRICES: any,
        newPrices: [],
        redstoneConfigManager: any,
        tokenManager: any,
        diamondAddress: any;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor, borrower, admin, liquidator] = await getFixedGasSigners(10000000);

      redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"], 30));
      let lendingPools = [];
      for (const token of [
        {'name': 'USDC', 'airdropList': [], 'autoPoolDeposit': false},
        {'name': 'AVAX', 'airdropList': [depositor, borrower], 'autoPoolDeposit': true},
        {'name': 'ETH', 'airdropList': [], 'autoPoolDeposit': false},
      ]) {
        let {poolContract, tokenContract} = await deployAndInitializeLendingPool(owner, token.name, token.airdropList);
        if(token.autoPoolDeposit) {
          await tokenContract!.connect(depositor).approve(poolContract.address, toWei("1000"));
          await poolContract.connect(depositor).deposit(toWei("1000"));
        }
        lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
        poolContracts[token.name] = poolContract;
        tokenContracts[token.name] = tokenContract;
      }
      tokenContracts['BTC'] = new ethers.Contract(TOKEN_ADDRESSES['BTC'], erc20ABI, provider);
      tokenContracts['YYAV3SA1'] = new ethers.Contract(TOKEN_ADDRESSES['YYAV3SA1'], erc20ABI, provider);

      supportedAssets = [
        new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
        new Asset(toBytes32('USDC'), TOKEN_ADDRESSES['USDC']),
        new Asset(toBytes32('ETH'), TOKEN_ADDRESSES['ETH']),
        new Asset(toBytes32('BTC'), TOKEN_ADDRESSES['BTC']),
        new Asset(toBytes32('YYAV3SA1'), TOKEN_ADDRESSES['YYAV3SA1']),
      ];

      INITIAL_MOCK_PRICES = [
        {
          symbol: 'AVAX',
          value: INITIAL_PRICES.AVAX
        },
        {
          symbol: 'USDC',
          value: INITIAL_PRICES.USDC
        },
        {
          symbol: 'ETH',
          value: INITIAL_PRICES.ETH
        },
        {
          symbol: 'BTC',
          value: INITIAL_PRICES.BTC
        },
        {
          symbol: 'YYAV3SA1',
          value: INITIAL_PRICES.YYAV3SA1
        },
      ];
      tokenManager = await deployContract(
          owner,
          TokenManagerArtifact,
          [
            supportedAssets,
            lendingPools
          ]
      ) as TokenManager;

      diamondAddress = await deployDiamond();

      await recompileSmartLoanLib(
          "SmartLoanConfigLib",
          [],
          tokenManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          ethers.constants.AddressZero,
          'lib'
      );

      exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, supportedAssets.map(asset => asset.assetAddress), "PangolinIntermediary") as PangolinIntermediary;
      //deposit other tokens
      await depositToPool("USDC", tokenContracts['USDC'], poolContracts.USDC, 10000, INITIAL_PRICES.USDC);
      await depositToPool("ETH", tokenContracts['ETH'], poolContracts.ETH, 1, INITIAL_PRICES.ETH);

      await topupUser(liquidator);
      await topupUser(borrower);

      async function depositToPool(symbol: string, tokenContract: Contract, pool: Pool, amount: number, price: number) {
        const initialTokenDepositWei = parseUnits(amount.toString(), await tokenContract.decimals());
        let requiredAvax = toWei((amount * price * 1.5 / INITIAL_PRICES.AVAX).toString());

        await tokenContracts['AVAX'].connect(depositor).deposit({value: requiredAvax});
        await tokenContracts['AVAX'].connect(depositor).transfer(exchange.address, requiredAvax);
        await exchange.connect(depositor).swap(tokenContracts['AVAX'].address, tokenContract.address, requiredAvax, initialTokenDepositWei);

        await tokenContract.connect(depositor).approve(pool.address, initialTokenDepositWei);
        await pool.connect(depositor).deposit(initialTokenDepositWei);
      }

      async function topupUser(user: SignerWithAddress) {
        await tokenContracts['AVAX'].connect(user).deposit({ value: toWei((10 * 10000 / INITIAL_PRICES.AVAX).toString()) });

        const amountSwapped = toWei((10000 / INITIAL_PRICES.AVAX).toString());
        await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
        await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['USDC'].address, amountSwapped, 0);

        await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
        await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['ETH'].address, amountSwapped, 0);

        await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
        await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['BTC'].address, amountSwapped, 0);
      }
    });

    before("prepare smart loan implementations", async () => {
      await recompileSmartLoanLib(
          "SmartLoanConfigLib",
          [
            {
              facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
              contractAddress: exchange.address,
            }
          ],
          tokenManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          ethers.constants.AddressZero,
          'lib'
      );

      await deployAllFacets(diamondAddress)
    });

    beforeEach("create a loan", async () => {
      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(diamondAddress);

      await recompileSmartLoanLib(
          "SmartLoanConfigLib",
          [
            {
              facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
              contractAddress: exchange.address,
            }
          ],
          tokenManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          smartLoansFactory.address,
          'lib'
      );
      await replaceFacet("OwnershipFacet", diamondAddress, ['transferOwnership']);

      await smartLoansFactory.connect(borrower).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

      loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

      wrappedLoan = WrapperBuilder
        .mockLite(loan)
        .using(
          () => {
            return {
              prices: INITIAL_MOCK_PRICES,
              timestamp: Date.now()
            }
          });
    });

      TEST_TABLE.forEach(
      async testCase => {
          it(`Testcase ${testCase.id}:\n
        fund AVAX: ${testCase.fund.AVAX}, USDC: ${testCase.fund.USDC}, ETH: ${testCase.fund.ETH}, BTC: ${testCase.fund.BTC}\n
        borrow AVAX: ${testCase.borrow.AVAX}, USDC: ${testCase.borrow.USDC}, ETH: ${testCase.borrow.ETH}`,
          async () => {
            //fund
            for (const [symbol, value] of Object.entries(testCase.fund)) {
              if (value > 0) {
                let contract = getTokenContract(symbol)!;
                let tokenDecimals = await contract.decimals();

                let requiredAvax = toWei((value * getPrice(symbol)! * 1.5 / INITIAL_PRICES.AVAX).toString());
                await tokenContracts['AVAX'].connect(borrower).deposit({value: requiredAvax});

                if (symbol !== 'AVAX') {
                  await tokenContracts['AVAX'].connect(borrower).transfer(exchange.address, requiredAvax);
                  await exchange.connect(borrower).swap(tokenContracts['AVAX'].address, tokenContracts[symbol].address, requiredAvax, toWei(value.toString(), tokenDecimals));
                }

                await contract.connect(borrower).approve(wrappedLoan.address, toWei(value.toString(), tokenDecimals));
                await wrappedLoan.fund(toBytes32(symbol), toWei(value.toString(), tokenDecimals));
              }
            }

            //borrow
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

            newPrices = INITIAL_MOCK_PRICES.map(
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
            const balances: any = {};

            for (const asset of (await wrappedLoan.getAllOwnedAssets())) {
              let balance = await tokenContracts[fromBytes32(asset)].balanceOf(wrappedLoan.address);
              let decimals = await tokenContracts[fromBytes32(asset)].decimals();
              balances[fromBytes32(asset)] = formatUnits(balance, decimals);
            }

            const debts: any = {};

            for (const asset of (await tokenManager.getAllPoolAssets())){
              if(poolContracts.hasOwnProperty(fromBytes32(asset))) {
                let debt = (await poolContracts[fromBytes32(asset)].getBorrowed(wrappedLoan.address));
                let decimals = await tokenContracts[fromBytes32(asset)].decimals();
                debts[fromBytes32(asset)] = formatUnits(debt, decimals);
              }
            }

            // From [{symbol: AVAX, value: 10}, {symbol: BTC, value: 2137}] to => {AVAX: 10, BTC: 2137}
            let newPricesArg = newPrices.reduce((acc, current:any) => Object.assign(acc, {[current.symbol]: current.value}), {})

            const repayAmounts = getRepayAmounts(
                testCase.action,
                debts,
                neededToRepay,
                newPricesArg
            );

            let loanIsBankrupt = await wrappedLoan.getTotalValue() < await wrappedLoan.getDebt();

            let allowanceAmounts;

            if (!loanIsBankrupt) {
              allowanceAmounts = toSupply(
                  balances,
                  repayAmounts
              );
            } else {
              allowanceAmounts = repayAmounts;
            }

            await action(wrappedLoan, testCase.action, allowanceAmounts, repayAmounts, bonus, testCase.stake);
            // @ts-ignore
            expect((await wrappedLoan.getLTV()).toNumber() / 1000).to.be.closeTo(testCase.targetLtv, testCase.ltvPrecision ?? 0.01);
          });
      }
   );


    async function action(
        wrappedLoan: Contract,
        performedAction: string,
        allowanceAmounts: any,
        repayAmounts: any,
        bonus: number,
        stake: any
        ) {
      const performer = performedAction === 'CLOSE' ? borrower : liquidator;
      const initialStakedYakTokensBalance = await tokenContracts['YYAV3SA1'].balanceOf(performer.address);
      expect(await wrappedLoan.isSolvent()).to.be.false;



      wrappedLoan = WrapperBuilder
        .mockLite(loan.connect(performer))
        .using(
          () => {
            return {
              prices: newPrices,
              timestamp: Date.now()
            }
          });

      let amountsToRepayInWei = [];
      let assetsToRepay = [];
      for (const [asset, amount] of Object.entries(repayAmounts) ) {
        let decimals = await tokenContracts[asset].decimals();
        amountsToRepayInWei.push(parseUnits((Number(amount).toFixed(decimals) ?? 0).toString(), decimals));
        assetsToRepay.push(toBytes32(asset));
      }

      for (const [asset, amount] of Object.entries(allowanceAmounts)) {
        let decimals = await tokenContracts[asset].decimals();
        let allowance = parseUnits((Number(amount).toFixed(decimals) ?? 0).toString(), decimals);
        await tokenContracts[asset].connect(performer).approve(wrappedLoan.address, allowance);
      }

      const bonusInWei = (bonus * 1000).toFixed(0);

      switch (performedAction) {
        case 'LIQUIDATE':
          await wrappedLoan.liquidateLoan(assetsToRepay, amountsToRepayInWei, bonusInWei);
          break;
        case 'HEAL':
          await wrappedLoan.unsafeLiquidateLoan(assetsToRepay, amountsToRepayInWei, bonusInWei);
          break;
      }

      expect(await wrappedLoan.isSolvent()).to.be.true;
      if(stake) {
        expect(await tokenContracts['YYAV3SA1'].balanceOf(performer.address)).to.be.gt(initialStakedYakTokensBalance);
      }
    }

    function getTokenContract(symbol: string) {
      if (symbol == "AVAX") return tokenContracts['AVAX'];
      if (symbol == "USDC") return tokenContracts['USDC'];
      if (symbol == "ETH") return tokenContracts['ETH'];
      if (symbol == "BTC") return tokenContracts['BTC'];
      if (symbol == "YYAV3SA1") return tokenContracts['YYAV3SA1'];
    }

    function getPrice(symbol: string) {
      if (symbol == "AVAX") return INITIAL_PRICES.AVAX;
      if (symbol == "USDC") return INITIAL_PRICES.USDC;
      if (symbol == "ETH") return INITIAL_PRICES.ETH;
      if (symbol == "BTC") return INITIAL_PRICES.BTC;
      if (symbol == "YYAV3SA1") return INITIAL_PRICES.YYAV3SA1;
    }
  });
});

