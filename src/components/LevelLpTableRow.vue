<template>
  <div class="lp-table-row-component level" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="lpToken">
      <div class="table__cell asset">
        <img class="asset__icon" :src="`src/assets/logo/${lpToken.symbol.toLowerCase()}.${lpToken.logoExt}`">
        <div class="asset__info">
          <a class="asset__name" :href="lpToken.link" target=”_blank”>{{ lpToken.name }}</a>
          <div class="asset__dex">
            by Level
          </div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value balance">
        <template v-if="levelLpBalances && parseFloat(levelLpBalances[lpToken.symbol])">
          <div class="double-value__pieces">
            <span v-if="isLpBalanceEstimated">~</span>
            {{ formatTokenBalance(levelLpBalances[lpToken.symbol], 10, true) }}
          </div>
          <div class="double-value__usd">
            <span v-if="levelLpBalances[lpToken.symbol]">
              {{ levelLpBalances[lpToken.symbol] * lpToken.price | usd }}
            </span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell rewards">
        0$
      </div>

      <div class="table__cell trend-level">
        <div class="trend__chart-change" v-on:click="toggleChart()">
          <SmallChartBeta :data-points="weeklyPrices"
                          :is-stable-coin="false"
                          :line-width="2"
                          :width="60"
                          :height="25"
                          :positive-change="weeklyPriceChange > 0">
          </SmallChartBeta>
        </div>
      </div>

      <div class="table__cell table__cell--double-value tvl">
        {{ tvl | usd }}
      </div>

      <div class="table__cell capacity">
        <bar-gauge-beta :min="0" :max="1" :value="0.5" v-tooltip="{content: `50% is used`, classes: 'info-tooltip'}"></bar-gauge-beta>
      </div>

      <div class="table__cell table__cell--double-value apr" v-bind:class="{'apr--with-warning': lpToken.aprWarning}">
        {{ apr / 100 | percent }}
        <div class="apr-warning" v-if="lpToken.aprWarning">
          <img src="src/assets/icons/warning.svg" v-tooltip="{content: lpToken.aprWarning, classes: 'info-tooltip long'}">
        </div>
      </div>

      <div class="table__cell table__cell--double-value max-apr">
        {{ maxApr | percent }}
      </div>

      <div class="table__cell"></div>

      <div class="table__cell actions">
        <IconButtonMenuBeta
            class="actions__icon-button"
            :config="addActionsConfig"
            v-if="addActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="disableAllButtons || !healthLoaded">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
            class="actions__icon-button last"
            :config="removeActionsConfig"
            v-if="removeActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="disableAllButtons || !healthLoaded">
        </IconButtonMenuBeta>
      </div>
    </div>
    <div class="chart-container" v-if="showChart">
      <SmallBlock v-on:close="toggleChart()">
        <Toggle class="chart-container__toggle" v-on:change="weekly = !weekly" :options="['7D', '24h']"
                :initial-option="0"></Toggle>
        <Chart :data-points="weekly ? weeklyPrices : dailyPrices"
               :line-width="3"
               :min-y="weekly ? weeklyMinPrice : dailyMinPrice"
               :max-y="weekly ? weeklyMaxPrice : dailyMaxPrice"
               :positive-change="weekly ? weeklyPriceChange > 0 : dailyPriceChange > 0">
        </Chart>
      </SmallBlock>
    </div>
  </div>
</template>

<script>
import DoubleAssetIcon from './DoubleAssetIcon';
import LoadedValue from './LoadedValue';
import SmallBlock from './SmallBlock';
import Chart from './Chart';
import IconButtonMenuBeta from './IconButtonMenuBeta';
import ColoredValueBeta from './ColoredValueBeta';
import SmallChartBeta from './SmallChartBeta';
import AddFromWalletModal from './AddFromWalletModal';
import config from '../config';
import {mapActions, mapState} from 'vuex';
import ProvideLiquidityModal from './ProvideLiquidityModal';
import RemoveLiquidityModal from './RemoveLiquidityModal';
import WithdrawModal from './WithdrawModal';

const ethers = require('ethers');
import erc20ABI from '../../test/abis/ERC20.json';
import {calculateMaxApy, chartPoints, fromWei} from '../utils/calculate';
import addresses from '../../common/addresses/avalanche/token_addresses.json';
import {formatUnits, parseUnits} from 'ethers/lib/utils';
import DeltaIcon from "./DeltaIcon.vue";
import SwapModal from "./SwapModal.vue";
import redstone from "redstone-api";
import Toggle from "./Toggle.vue";
import TradingViewChart from "./TradingViewChart.vue";
import LIQUIDITY_CALCULATOR from '/artifacts/contracts/interfaces/level/ILiquidityCalculator.sol/ILiquidityCalculator.json'
import {BigNumber} from "ethers";
import BarGaugeBeta from "./BarGaugeBeta.vue";

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'LevelLpTableRow',
  components: {
    BarGaugeBeta,
    TradingViewChart, Toggle,
    DeltaIcon,
    DoubleAssetIcon,
    LoadedValue,
    SmallBlock,
    Chart,
    IconButtonMenuBeta,
    ColoredValueBeta,
    SmallChartBeta
  },
  props: {
    lpToken: null
  },

  async mounted() {
    this.setupAddActionsConfiguration();
    this.setupRemoveActionsConfiguration();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchHardRefreshScheduledEvent();
    this.watchHealth();
    this.watchProgressBarState();
    this.watchAssetApysRefresh();
    this.watchExternalAssetBalanceUpdate();
    this.fetchHistoricalPrices();
    this.setupTvl();
    await this.setupApr();
  },

  data() {
    return {
      addActionsConfig: null,
      removeActionsConfig: null,
      rowExpanded: false,
      poolBalance: 0,
      apr: 0,
      tvl: 0,
      weekly: true,
      weeklyPrices: [],
      weeklyPriceChange: 0,
      weeklyMinPrice: 0,
      weeklyMaxPrice: 0,
      dailyPrices: [],
      dailyPriceChange: 0,
      dailyMinPrice: 0,
      dailyMaxPrice: 0,
      lpTokenBalances: [],
      isLpBalanceEstimated: false,
      disableAllButtons: false,
      healthLoaded: false,
      showChart: false
    };
  },

  computed: {
    ...mapState('fundsStore', [
      'health',
      'levelLpBalances',
      'lpBalances',
      'smartLoanContract',
      'fullLoanStatus',
      'assetBalances',
      'levelLpBalances',
      'assets',
      'debtsPerAsset',
      'lpAssets',
      'concentratedLpAssets',
      'levelLpAssets',
      'traderJoeV2LpAssets'
    ]),
    ...mapState('poolStore', ['pools']),
    ...mapState('network', ['account', 'provider']),
    ...mapState('serviceRegistry', [
      'assetBalancesExternalUpdateService',
      'dataRefreshEventService',
      'progressBarService',
      'lpService',
      'healthService'
    ]),
    ...mapState('stakeStore', ['farms']),

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },

    maxApr() {
      return calculateMaxApy(this.pools, this.apr / 100);
    },
  },

  watch: {
    smartLoanContract: {
      handler(smartLoanContract) {
        if (smartLoanContract) {
          this.setupAddActionsConfiguration();
          this.setupRemoveActionsConfiguration();
        }
      },
    },
    provider: {
      async handler(provider) {
        if (provider) {
          await this.setupPoolBalance();
        }
      }
    }
  },

  methods: {
    ...mapActions('fundsStore', ['fund', 'withdraw', 'addLiquidityLevelFinance', 'removeLiquidityLevelFinance']),
    setupAddActionsConfiguration() {
      this.addActionsConfig =
          {
            iconSrc: 'src/assets/icons/plus.svg',
            tooltip: 'Add',
            menuOptions: [
              {
                key: 'ADD_FROM_WALLET',
                name: 'Import existing LLP position',
                disabled: true,
                disabledInfo: 'Coming soon!'
              },
              {
                key: 'PROVIDE_LIQUIDITY',
                name: 'Create LLP position',
                disabled: !this.hasSmartLoanContract || !this.lpTokenBalances,
                disabledInfo: 'To create LP token, you need to add some funds from you wallet first'
              }
            ]
          }
    },

    setupRemoveActionsConfiguration() {
      this.removeActionsConfig =
          {
            iconSrc: 'src/assets/icons/minus.svg',
            tooltip: 'Remove',
            menuOptions: [
              {
                key: 'WITHDRAW',
                name: 'Export LP position',
                disabled: true || !this.hasSmartLoanContract || !this.lpTokenBalances,
                disabledInfo: 'Coming soon!'
              },
              {
                key: 'REMOVE_LIQUIDITY',
                name: 'Remove LLP position',
                disabled: !this.hasSmartLoanContract || !this.lpTokenBalances,
              }
            ]
          }
    },

    async setupApr() {
      if (!this.lpToken.apy) return;
      this.apr = this.lpToken.apy;
    },

    toggleChart() {
      if (this.rowExpanded) {
        this.showChart = false;
        this.rowExpanded = false;
      } else {
        this.rowExpanded = true;
        setTimeout(() => {
          this.showChart = true;
        }, 200);
      }
    },

    actionClick(key) {
      if (!this.disableAllButtons && this.healthLoaded) {
        switch (key) {
          case 'ADD_FROM_WALLET':
            this.openAddFromWalletModal();
            break;
          case 'PROVIDE_LIQUIDITY':
            this.openProvideLiquidityModal();
            break;
          case 'WITHDRAW':
            this.openWithdrawModal();
            break;
          case 'REMOVE_LIQUIDITY':
            this.openRemoveLiquidityModal();
            break;
        }
      }
    },

    levelFinanceQuery() {
      const calculator = new ethers.Contract(config.levelLiquidityCalculatorAddress, LIQUIDITY_CALCULATOR.abi, provider.getSigner());
      const llpContract = new ethers.Contract(this.lpToken.address, erc20ABI, provider.getSigner());

      return async (sourceAsset, targetAsset, amountIn) => {
        if (config.LEVEL_LP_ASSETS_CONFIG[sourceAsset]) {
          const llp = config.LEVEL_LP_ASSETS_CONFIG[sourceAsset];
          const trancheValue = await calculator.getTrancheValue(llp.address, true);
          const llpSupply = await llpContract.totalSupply();
          const llpSellPrice = formatUnits(trancheValue.div(llpSupply), 12);

          const target = config.ASSETS_CONFIG[targetAsset];
          const targetPrice = target.price;
          const ratio = llpSellPrice / targetPrice;
          const amountOut = ratio * formatUnits(amountIn, 18);

          return parseUnits(amountOut.toFixed(target.decimals), target.decimals);
        } else {
          const llp = config.LEVEL_LP_ASSETS_CONFIG[targetAsset];
          const trancheValue = await calculator.getTrancheValue(llp.address, false);
          const llpSupply = await llpContract.totalSupply();
          const llpBuyPrice = formatUnits(trancheValue.div(llpSupply), 12);
          const source = config.ASSETS_CONFIG[sourceAsset];
          const sourcePrice = source.price;
          const ratio = sourcePrice / llpBuyPrice;
          const amountOut = ratio * formatUnits(amountIn, source.decimals);

          return parseUnits(amountOut.toFixed(18), 18);
        }
      }
    },

    levelFinanceFee() {
      return async (sourceAsset, targetAsset, amountIn) => {
       return Promise.resolve(0.000);
      }
    },

    async openAddFromWalletModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      modalInstance.asset = this.lpToken;
      modalInstance.assetBalance = this.levelLpBalances && this.levelLpBalances[this.lpToken.symbol] ? this.levelLpBalances[this.lpToken.symbol] : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.loan = this.debt;
      modalInstance.thresholdWeightedValue = this.thresholdWeightedValue;
      modalInstance.isLP = false;
      modalInstance.logo = `${this.lpToken.symbol.toLowerCase()}.${this.lpToken.logoExt}`;
      modalInstance.walletAssetBalance = await this.getWalletLpTokenBalance();
      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
          const fundRequest = {
            value: addFromWalletEvent.value.toString(),
            asset: this.lpToken.symbol,
            assetDecimals: config.LEVEL_LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
            type: 'ASSET',
          };
          this.handleTransaction(this.fund, {fundRequest: fundRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    //TODO: duplicated code
    openWithdrawModal() {
      const modalInstance = this.openModal(WithdrawModal);
      modalInstance.asset = this.lpToken;
      modalInstance.assetBalance = this.levelLpBalances[this.lpToken.symbol];
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.farms = this.farms;
      modalInstance.health = this.health;
      modalInstance.isLP = false;
      modalInstance.logo = `${this.lpToken.symbol.toLowerCase()}.${this.lpToken.logoExt}`;
      modalInstance.$on('WITHDRAW', withdrawEvent => {
        const withdrawRequest = {
          value: withdrawEvent.value.toString(),
          asset: this.lpToken.symbol,
          assetDecimals: config.LEVEL_LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
          type: 'ASSET',
        };
        this.handleTransaction(this.withdraw, {withdrawRequest: withdrawRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    openProvideLiquidityModal() {
      console.log('openProvideLiquidityModal')
      const modalInstance = this.openModal(SwapModal);
      let initSourceAsset = [...this.lpToken.underlyingAssets][0];
      modalInstance.title = 'Create LLP position';
      modalInstance.swapDex = 'Level';
      modalInstance.swapDebtMode = false;
      modalInstance.userSlippage = 0.1;
      modalInstance.sourceAsset = initSourceAsset;
      modalInstance.sourceAssetBalance = this.assetBalances[initSourceAsset];
      modalInstance.assets = { ...this.assets, ...this.levelLpAssets };
      modalInstance.sourceAssets = { Level: [...this.lpToken.underlyingAssets] };
      modalInstance.targetAssetsConfig = config.LEVEL_LP_ASSETS_CONFIG;
      modalInstance.targetAssets = { Level: [this.lpToken.symbol] };
      modalInstance.assetBalances = { ...this.assetBalances, ...this.levelLpBalances };
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = this.lpToken.symbol;
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;

      modalInstance.queryMethods = {
        Level: this.levelFinanceQuery(),
      };

      modalInstance.feeMethods = {
        Level: this.levelFinanceFee(),
      };

      modalInstance.$on('SWAP', swapEvent => {

        const addLiquidityRequest = {
          sourceAsset: swapEvent.sourceAsset,
          sourceAmount: swapEvent.sourceAmount,
          targetAsset: swapEvent.targetAsset,
          targetAmount: swapEvent.targetAmount,
          method: `levelStake${swapEvent.sourceAsset.charAt(0) + swapEvent.sourceAsset.toLowerCase().slice(1)}${this.lpToken.short}`
        };
        console.log(addLiquidityRequest)

        this.handleTransaction(this.addLiquidityLevelFinance, {addLiquidityRequest: addLiquidityRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });

      modalInstance.initiate();
    },

    openRemoveLiquidityModal() {
      const modalInstance = this.openModal(SwapModal);
      modalInstance.title = 'Unwind LLP position';
      modalInstance.swapDex = 'Level';
      modalInstance.dexOptions = ['Level'];
      modalInstance.swapDebtMode = false;
      modalInstance.userSlippage = 0.1;
      modalInstance.sourceAsset = this.lpToken.symbol;
      modalInstance.sourceAssetBalance = this.levelLpBalances[this.lpToken.symbol];
      modalInstance.sourceAssetsConfig = config.LEVEL_LP_ASSETS_CONFIG;
      modalInstance.assets = { ...this.assets, ...this.levelLpAssets };
      modalInstance.sourceAssets = { Level: [this.lpToken.symbol]} ;
      modalInstance.targetAssets = { Level: [...this.lpToken.underlyingAssets] };
      modalInstance.assetBalances = { ...this.assetBalances, ...this.levelLpBalances };
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = this.lpToken.underlyingAssets[0];
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.queryMethods = {
        Level: this.levelFinanceQuery(),
      };
      modalInstance.feeMethods = {
        Level: this.levelFinanceFee(),
      };
      modalInstance.swapDex = 'Level';
      modalInstance.$on('SWAP', swapEvent => {

        const removeLiquidityRequest = {
          sourceAsset: swapEvent.sourceAsset,
          sourceAmount: swapEvent.sourceAmount,
          targetAsset: swapEvent.targetAsset,
          targetAmount: swapEvent.targetAmount,
          method: `levelUnstake${swapEvent.targetAsset.charAt(0).toUpperCase() + swapEvent.targetAsset.toLowerCase().slice(1)}${this.lpToken.short}`
        };

        this.handleTransaction(this.removeLiquidityLevelFinance, {removeLiquidityRequest: removeLiquidityRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });

      modalInstance.initiate();
    },

    async setupPoolBalance() {
      const lpTokenContract = new ethers.Contract(this.lpToken.address, erc20ABI, provider);
      this.poolBalance = fromWei(await lpTokenContract.totalSupply());
    },

    async setupTvl() {
      this.tvl = (await (await fetch(`https://uophm6e26f.execute-api.us-east-1.amazonaws.com/levelTvl/${this.lpToken.symbol}`)).json()).tvl;
    },

    async getWalletLpTokenBalance() {
      const tokenContract = new ethers.Contract(this.lpToken.address, erc20ABI, this.provider.getSigner());

      return await this.getWalletTokenBalance(this.account, this.lpToken.symbol, tokenContract, this.lpToken.decimals);
    },

    watchAssetBalancesDataRefreshEvent() {
      this.dataRefreshEventService.assetBalancesDataRefreshEvent$.subscribe(() => {
        this.isLpBalanceEstimated = false;
        this.disableAllButtons = false;
        this.$forceUpdate();
      });
    },

    watchHardRefreshScheduledEvent() {
      this.dataRefreshEventService.hardRefreshScheduledEvent$.subscribe(() => {
        this.disableAllButtons = true;
        this.$forceUpdate();
      });
    },

    watchHealth() {
      console.log('watchHealth')
      this.healthService.observeHealth().subscribe(health => {
        console.log('healthLoaded')
        this.healthLoaded = true;
      });
    },

    watchAssetApysRefresh() {
      this.dataRefreshEventService.observeAssetApysDataRefresh().subscribe(async () => {
        await this.setupApr();
      })
    },

    watchExternalAssetBalanceUpdate() {
      this.assetBalancesExternalUpdateService.observeExternalAssetBalanceUpdate().subscribe(updateEvent => {
        if (updateEvent.assetSymbol === this.lpToken.symbol) {
          this.levelLpBalances[this.lpToken.symbol] = updateEvent.balance;
          this.isLpBalanceEstimated = !updateEvent.isTrueData;
          this.$forceUpdate();
        }
      })
    },

    scheduleHardRefresh() {
      setTimeout(() => {
        this.progressBarService.emitProgressBarInProgressState();
        this.dataRefreshEventService.emitHardRefreshScheduledEvent();
      }, 3000)
    },

    watchProgressBarState() {
      this.progressBarService.progressBarState$.subscribe((state) => {
        switch (state) {
          case 'MINING' : {
            this.disableAllButtons = true;
            break;
          }
          case 'SUCCESS': {
            this.disableAllButtons = false;
            break;
          }
          case 'ERROR' : {
            this.disableAllButtons = false;
            this.isLpBalanceEstimated = false;
            break;
          }
          case 'CANCELLED' : {
            this.disableAllButtons = false;
            this.isLpBalanceEstimated = false;
            break;
          }
        }
      })
    },

    async fetchHistoricalPrices() {
      [this.weeklyPrices, this.weeklyMinPrice, this.weeklyMaxPrice, this.weeklyPriceChange] = await this.fetchPricesForInterval(3600 * 1000 * 7 * 24, 6 * 3600 * 1000);
      [this.dailyPrices, this.dailyMinPrice, this.dailyMaxPrice, this.dailyPriceChange] = await this.fetchPricesForInterval(3600 * 1000 * 24, 3600 * 1000);
    },

    async fetchPricesForInterval(period, interval) {
      const response = await redstone.getHistoricalPrice(this.lpToken.symbol, {
        startDate: Date.now() - period,
        interval: interval,
        endDate: Date.now(),
        provider: config.dataProviderHistoricalPrices
      });

      const [prices, minPrice, maxPrice] = chartPoints(
          response
      );

      const priceChange = prices && (prices[prices.length - 1].y - prices[0].y) / prices[prices.length - 1].y;

      return [prices, minPrice, maxPrice, priceChange];
    },

    handleTransactionError(error) {
      if (error.code === 4001 || error.code === -32603) {
        this.progressBarService.emitProgressBarCancelledState();
      } else {
        this.progressBarService.emitProgressBarErrorState();
      }
      this.closeModal();
      this.disableAllButtons = false;
      this.isLpBalanceEstimated = false;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.lp-table-row-component {
  height: 60px;
  transition: all 200ms;

  &.expanded {
    height: 477px;
  }

  .table__row {
    display: grid;
    grid-template-columns: repeat(6, 1fr) 120px 120px 60px 80px 22px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.asset {
        align-items: center;

        .asset__name {
          color: var(--default-text-color);
        }

        .asset__icon {
          width: 20px;
          height: 20px;
          opacity: var(--asset-table-row__icon-opacity);
        }

        .asset__info {
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-left: 8px;
          font-weight: 500;
        }

        .asset__dex {
          font-size: $font-size-xxs;
          color: var(--asset-table-row__asset-loan-color);
        }
      }

      &.balance, &.trend-level, &.rewards {
        align-items: flex-end;
      }

      &.capacity, &.rewards {
        flex-direction: column;
        justify-content: center;
        align-items: flex-end;
      }

      &.trend-level {
        cursor: pointer;
        justify-content: center;
        align-items: center;
        margin-left: 66px;
      }

      &.apr, &.max-apr, &.tvl {
        align-items: flex-end;
      }

      &.max-apr {
        font-weight: 600;
      }

      &.actions {
        align-items: center;

        .actions__icon-button {
          &:not(:last-child) {
            margin-right: 12px;
          }
        }
      }

      &.table__cell--double-value {
        flex-direction: column;
        justify-content: center;

        .double-value__pieces {
          font-size: $font-size-xsm;
          font-weight: 600;
        }

        .double-value__usd {
          font-size: $font-size-xxs;
          color: var(--asset-table-row__double-value-color);
          font-weight: 500;
        }

        &.loan {
          .double-value__pieces {
            font-weight: 500;
          }
        }
      }

      .no-value-dash {
        height: 1px;
        width: 15px;
        background-color: var(--asset-table-row__no-value-dash-color);
      }
    }
  }

  .chart-container {
    margin: 2rem 0;

    .small-block-wrapper {
      height: unset;
    }
  }
}

.action-button {
  cursor: pointer;
  background: var(--icon-button-menu-beta__icon-color--default);

  &:not(:last-child) {
    margin-right: 12px;
  }

  &:hover {
    background: var(--icon-button-menu-beta__icon-color-hover--default);
  }

  &.action-button--disabled {
    background: var(--icon-button-menu-beta__icon-color--disabled);
    cursor: default;
    pointer-events: none;
  }
}

</style>
<style lang="scss">
.level {
  .table__row {
    .bar-gauge-beta-component .bar-gauge .bar {
      width: 80px;
    }
  }
}
</style>