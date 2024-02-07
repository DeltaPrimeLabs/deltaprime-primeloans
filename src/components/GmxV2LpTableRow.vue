<template>
  <div class="lp-table-row-component gmxV2" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="lpToken">
      <div class="table__cell asset">
        <img class="asset__icon" :src="getAssetIcon(lpToken.longToken)">
        <div class="asset__info">
          <a class="asset__name" :href="lpToken.link" target=”_blank”>{{ lpToken.name }}</a>
          <div class="asset__dex">
            by <a v-on:click="openProfileModal"><b>GMX V2</b></a>
          </div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value balance">
        <template v-if="gmxV2Balances && parseFloat(gmxV2Balances[lpToken.symbol])">
          <div class="double-value__pieces">
            <span v-if="isLpBalanceEstimated">~</span>
            {{ formatTokenBalance(gmxV2Balances[lpToken.symbol], 10, true) }}
          </div>
          <div class="double-value__usd">
            <span v-if="gmxV2Balances[lpToken.symbol]">
              {{ gmxV2Balances[lpToken.symbol] * lpToken.price | usd }}
            </span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <!--      composition-->
      <div class="table__cell table__cell--double-value balance">
        <template>
          <div class="table__cell composition">
            <img class="asset__icon" :src="getAssetIcon(lpToken.longToken)">{{
              formatTokenBalance(longTokenAmount ? longTokenAmount : 0, 6, true)
            }}
            <img class="asset__icon" :src="getAssetIcon(lpToken.shortToken)">{{
              formatTokenBalance(shortTokenAmount ? shortTokenAmount : 0, 6, true)
            }}
          </div>
          <div class="double-value__usd">
            <span>
              {{((gmxV2Balances && gmxV2Balances[lpToken.symbol]) ? gmxV2Balances[lpToken.symbol] : 0) * lpToken.price | usd}}
            </span>
          </div>
        </template>
      </div>

      <div class="table__cell trend-gmxV2">
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
        {{ formatTvl(tvl) }}
      </div>

<!--      <div class="table__cell capacity">-->
<!--        <bar-gauge-beta v-if="lpToken.maxExposure" :min="0" :max="lpToken.maxExposure" :value="Math.max(lpToken.currentExposure, 0.001)" v-tooltip="{content: `${lpToken.currentExposure ? lpToken.currentExposure.toFixed(2) : 0} ($${lpToken.currentExposure ? (lpToken.currentExposure * this.lpToken.price).toFixed(2) : 0}) out of ${lpToken.maxExposure} ($${lpToken.maxExposure ? (lpToken.maxExposure * this.lpToken.price).toFixed(2) : 0}) is currently used.`, classes: 'info-tooltip'}" :width="80"></bar-gauge-beta>-->
<!--      </div>-->

      <div class="table__cell table__cell--double-value apr" v-bind:class="{'apr--with-warning': lpToken.aprWarning}">
        {{ apr / 100 | percent }}
        <div class="apr-warning" v-if="lpToken.aprWarning">
          <img src="src/assets/icons/warning.svg" v-tooltip="{content: lpToken.aprWarning, classes: 'info-tooltip long'}">
        </div>
      </div>

      <div class="table__cell table__cell--double-value max-apr">
        <span>{{ (maxApr + gmBoost) | percent }}<img v-if="hasGmIncentives" v-tooltip="{content: `This pool is incentivized!<br>⁃ up to ${maxApr ? (maxApr * 100).toFixed(2) : 0}% Pool APR<br>⁃ up to ${gmBoost ? (gmBoost * 100).toFixed(2) : 0}% ARB incentives`, classes: 'info-tooltip'}" src="src/assets/icons/stars.png" class="stars-icon"></span>
      </div>

      <div class="table__cell"></div>

      <div class="table__cell actions">
        <IconButtonMenuBeta
            class="actions__icon-button"
            :config="addActionsConfig"
            v-if="addActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="disableAllButtons || !healthLoaded || !assets">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
            class="actions__icon-button last"
            :config="removeActionsConfig"
            v-if="removeActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="disableAllButtons || !healthLoaded || !assets">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
            class="actions__icon-button"
            v-if="moreActionsConfig"
            :config="moreActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="disableAllButtons || !healthLoaded || !assets">
        </IconButtonMenuBeta>
      </div>
    </div>
    <div class="chart-container" v-if="showChart">
      <SmallBlock v-on:close="toggleChart()">
        <div class="chart-toggles">
          <Dropdown class="chart-dropdown" v-if="openInterestData"
                    :options="[{name: 'Price', value: 'PRICE'}, {name: 'Open Interest', value: 'OPEN_INTEREST'}]"
                    @dropdownSelected="handleDropdownOption"></Dropdown>
          <Toggle v-bind:style="{ 'visibility': selectedChart === 'PRICE' ? 'visible' : 'hidden' }"
                  class="chart-container__toggle" v-on:change="weekly = !weekly"
                  :options="['7D', '24h']"
                  :initial-option="0"></Toggle>
        </div>
        <Chart v-if="selectedChart === 'PRICE'"
               :data-points="weekly ? weeklyPrices : dailyPrices"
               :line-width="3"
               :min-y="weekly ? weeklyMinPrice : dailyMinPrice"
               :max-y="weekly ? weeklyMaxPrice : dailyMaxPrice"
               :positive-change="weekly ? weeklyPriceChange > 0 : dailyPriceChange > 0">
        </Chart>
        <Chart v-if="selectedChart === 'OPEN_INTEREST'"
               :data-points="openInterestData"
               :line-width="3"
               :min-y="0"
               :max-y="99"
               :values-type="'PERCENTAGE'"
               :positive-change="true">
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
import {calculateMaxApy, chartPoints, fromWei, toWei} from '../utils/calculate';
import addresses from '../../common/addresses/avalanche/token_addresses.json';
import {formatUnits, parseUnits} from 'ethers/lib/utils';
import DeltaIcon from "./DeltaIcon.vue";
import SwapModal from "./SwapModal.vue";
import redstone from "redstone-api";
import Toggle from "./Toggle.vue";
import TradingViewChart from "./TradingViewChart.vue";
import BarGaugeBeta from "./BarGaugeBeta.vue";
import PartnerInfoModal from "./PartnerInfoModal.vue";
import moment from "moment/moment";
import LIQUIDITY_CALCULATOR
  from "../../artifacts/contracts/interfaces/level/ILiquidityCalculator.sol/ILiquidityCalculator.json";
import IREADER_DEPOSIT_UTILS
  from "../../artifacts/contracts/interfaces/gmx-v2/IReaderDepositUtils.sol/IReaderDepositUtils.json";
import IDATA_STORE
  from "../../artifacts/contracts/interfaces/gmx-v2/IDataStore.sol/IDataStore.json";
import SwapToMultipleModal from "./SwapToMultipleModal.vue";
import TOKEN_ADDRESSES from "../../common/addresses/avalanche/token_addresses.json";
import {BigNumber} from "ethers";
import {
  DEPOSIT_GAS_LIMIT_KEY,
  ESTIMATED_GAS_FEE_BASE_AMOUNT,
  ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR, WITHDRAWAL_GAS_LIMIT_KEY
} from "../integrations/contracts/dataStore";
import zapLong from "./zaps-tiles/ZapLong.vue";
import {calculateGmxV2ExecutionFee, capitalize, hashData} from "../utils/blockchain";
import Dropdown from "./notifi/settings/Dropdown.vue";

export default {
  name: 'GmxV2LpTableRow',
  components: {
    Dropdown,
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
    lpToken: null,
    openInterestData: null,
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
    this.watchAsset();
    this.watchAssetPricesUpdate();
    this.fetchHistoricalPrices();
  },

  data() {
    return {
      addActionsConfig: null,
      removeActionsConfig: null,
      moreActionsConfig: null,
      rowExpanded: false,
      poolBalance: 0,
      rewards: 0,
      rewardsInUsd: 0,
      gmPrice: 0,
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
      showChart: false,
      longTokenAmount: 0,
      shortTokenAmount: 0,
      selectedChart: 'PRICE',
    };
  },

  computed: {
    ...mapState('fundsStore', [
      'health',
      'lpBalances',
      'smartLoanContract',
      'fullLoanStatus',
      'assetBalances',
      'concentratedLpBalances',
      'levelLpBalances',
      'gmxV2Balances',
      'assets',
      'debtsPerAsset',
      'lpAssets',
      'concentratedLpAssets',
      'levelLpAssets',
      'gmxV2Assets',
      'traderJoeV2LpAssets',
      'balancerLpAssets',
      'balancerLpBalances',
      'apys',
    ]),
    ...mapState('poolStore', ['pools']),
    ...mapState('network', ['account', 'provider']),
    ...mapState('serviceRegistry', [
      'assetBalancesExternalUpdateService',
      'dataRefreshEventService',
      'progressBarService',
      'priceService',
      'lpService',
      'healthService'
    ]),
    ...mapState('stakeStore', ['farms']),

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== this.nullAddress;
    },

    maxApr() {
      if (!this.apys) return;
      return calculateMaxApy(this.pools, this.apr / 100);
    },

    gmBoost() {
      if (!this.apys || !this.assets || !this.assets['ARB'] || !this.assets['ARB'].price) return 0;
      let apy = this.apys['GM_BOOST'].arbApy * (this.assets['ARB'].price || 0);
      return this.hasGmIncentives ? 4.5 * apy : 0;
    },

    hasGmIncentives() {
      return config.chainId === 42161;
    }
  },

  watch: {
    smartLoanContract: {
      handler(smartLoanContract) {
        if (smartLoanContract) {
          this.setupAddActionsConfiguration();
          this.setupRemoveActionsConfiguration();
          this.setupMoreActionsConfiguration();
        }
      },
    },
    provider: {
      async handler(provider) {
        if (provider) {
          this.setupPoolBalance();
        }
      }
    },
    gmxV2Balances: {
      async handler(gmxV2Balances) {
        if (gmxV2Balances) {
          this.setupGmUnderlyingBalances();
        }
      }
    },
  },

  methods: {
    ...mapActions('fundsStore', [
      'fund',
      'withdraw',
      'addLiquidityGmxV2',
      'removeLiquidityGmxV2',
    ]),
    setupAddActionsConfiguration() {
      this.addActionsConfig =
          {
            iconSrc: 'src/assets/icons/plus.svg',
            tooltip: 'Add',
            menuOptions: [
              {
                key: 'ADD_FROM_WALLET',
                name: 'Import existing GM token',
                disabled: !this.hasSmartLoanContract,
                disabledInfo: 'To import GM token, you need to add some funds from you wallet first'
              },
              {
                key: 'PROVIDE_LIQUIDITY',
                name: 'Create GM position',
                disabled: !this.hasSmartLoanContract,
                disabledInfo: 'To create GM token, you need to add some funds from you wallet first'
              }
            ]
          }
    },
    handleDropdownOption(option) {
      this.selectedChart = option.value;
    },

    setupRemoveActionsConfiguration() {
      this.removeActionsConfig =
          {
            iconSrc: 'src/assets/icons/minus.svg',
            tooltip: 'Remove',
            menuOptions: [
              {
                key: 'WITHDRAW',
                name: 'Export GM position',
                disabled: !this.hasSmartLoanContract
              },
              {
                key: 'REMOVE_LIQUIDITY',
                name: 'Remove GM position',
                disabled: !this.hasSmartLoanContract,
                disabledInfo: 'You need to add some funds from you wallet first'
              }
            ]
          }
    },

    setupMoreActionsConfiguration() {
      this.moreActionsConfig = {
        iconSrc: 'src/assets/icons/icon_a_more.svg',
        tooltip: 'More',
        menuOptions: [
          {
            key: 'PARTNER_PROFILE',
            name: 'Show profile',
          }
        ]
      };
    },

    async setupApr() {
      if (!this.lpToken.apy) return;
      this.apr = this.lpToken.apy;
    },

    async setupGmUnderlyingBalances() {
      const depositReader = new ethers.Contract(config.gmxV2ReaderAddress, IREADER_DEPOSIT_UTILS.abi, this.provider.getSigner());

      const longToken = config.ASSETS_CONFIG[this.lpToken.longToken];
      const shortToken = config.ASSETS_CONFIG[this.lpToken.shortToken];

      const marketProps = {
        marketToken: this.lpToken.address,
        indexToken: this.lpToken.indexTokenAddress,
        longToken: longToken.address,
        shortToken: shortToken.address
      }

      let gmxData;
      if (window.chain === 'arbitrum') {
        console.log(0)
        console.log(`https://${config.chainSlug}-api.gmxinfra.io/prices/tickers`)
        gmxData = await (await fetch(`https://${config.chainSlug}-api.gmxinfra.io/prices/tickers`)).json();
        console.log(1)
      } else {
        gmxData = JSON.parse('[{"tokenAddress":"0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB","tokenSymbol":"ETH","minPrice":"2376284700000000","maxPrice":"2376284700000000","updatedAt":1707272591518},{"tokenAddress":"0x152b9d0FdC40C096757F570A51E494bd4b943E50","tokenSymbol":"BTC","minPrice":"430397400000000000000000000","maxPrice":"430397400000000000000000000","updatedAt":1707272591119},{"tokenAddress":"0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7","tokenSymbol":"AVAX","minPrice":"34196331000000","maxPrice":"34196331000000","updatedAt":1707272589916},{"tokenAddress":"0x5947BB275c521040051D82396192181b413227A3","tokenSymbol":"LINK","minPrice":"18312430870000","maxPrice":"18312430870000","updatedAt":1707272589716},{"tokenAddress":"0xFE6B19286885a4F7F55AdAD09C3Cd1f906D2478F","tokenSymbol":"SOL","minPrice":"96820000000000000000000","maxPrice":"96820000000000000000000","updatedAt":1707272589516},{"tokenAddress":"0xC301E6fe31062C557aEE806cc6A841aE989A3ac6","tokenSymbol":"DOGE","minPrice":"788116000000000000000","maxPrice":"788116000000000000000","updatedAt":1707272589716},{"tokenAddress":"0x8E9C35235C38C44b5a53B56A41eaf6dB9a430cD6","tokenSymbol":"LTC","minPrice":"680795000000000000000000","maxPrice":"680795000000000000000000","updatedAt":1707272591722},{"tokenAddress":"0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E","tokenSymbol":"USDC","minPrice":"1000000000000000000000000","maxPrice":"1000198000000000000000000","updatedAt":1707272588361},{"tokenAddress":"0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664","tokenSymbol":"USDC.e","minPrice":"1000000000000000000000000","maxPrice":"1000198000000000000000000","updatedAt":1707272588361},{"tokenAddress":"0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7","tokenSymbol":"USDT","minPrice":"999259570000000000000000","maxPrice":"1000000000000000000000000","updatedAt":1707272588361},{"tokenAddress":"0xc7198437980c041c805A1EDcbA50c1Ce5db95118","tokenSymbol":"USDT.e","minPrice":"999259570000000000000000","maxPrice":"1000000000000000000000000","updatedAt":1707272588361},{"tokenAddress":"0xd586E7F844cEa2F87f50152665BCbc2C279D8d70","tokenSymbol":"DAI.e","minPrice":"999900000000","maxPrice":"1000000000000","updatedAt":1707272588361},{"tokenAddress":"0x34B2885D617cE2ddeD4F60cCB49809fc17bb58Af","tokenSymbol":"XRP","minPrice":"504763000000000000000000","maxPrice":"504763000000000000000000","updatedAt":1707272591518}]')
      }

      let shortTokenGmxData = gmxData.find(el => el.tokenSymbol === shortToken.symbol);
      let longTokenGmxData = gmxData.find(el => el.tokenSymbol === longToken.symbol);
      let indexTokenGmxData = gmxData.find(el => el.tokenAddress.toLowerCase() === this.lpToken.indexTokenAddress.toLowerCase());

      const prices = {
        indexTokenPrice: {
          min: BigNumber.from(indexTokenGmxData.minPrice),
          max: BigNumber.from(indexTokenGmxData.maxPrice)
        },
        longTokenPrice: {
          min: BigNumber.from(longTokenGmxData.minPrice),
          max: BigNumber.from(longTokenGmxData.maxPrice)
        },
        shortTokenPrice: {
          min: BigNumber.from(shortTokenGmxData.minPrice),
          max: BigNumber.from(shortTokenGmxData.maxPrice)
        }
      }

      let [longTokenOut, shortTokenOut] = await depositReader.getWithdrawalAmountOut(
          config.gmxV2DataStoreAddress, marketProps, prices, toWei((this.gmxV2Balances[this.lpToken.symbol]).toString()), this.nullAddress
      );

      this.longTokenAmount = formatUnits(longTokenOut, longToken.decimals);
      this.shortTokenAmount = formatUnits(shortTokenOut, shortToken.decimals);
    },

    toggleChart() {
      if (this.rowExpanded) {
        this.showChart = false;
        this.rowExpanded = false;
        this.selectedChart = 'PRICE';
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
          case 'PARTNER_PROFILE':
            this.openProfileModal();
            break;
        }
      }
    },

    gmxV2Query() {
      const depositReader = new ethers.Contract(config.gmxV2ReaderAddress, IREADER_DEPOSIT_UTILS.abi, this.provider.getSigner());

      const longToken = config.ASSETS_CONFIG[this.lpToken.longToken];
      const shortToken = config.ASSETS_CONFIG[this.lpToken.shortToken];

      const marketProps = {
        marketToken: this.lpToken.address,
        indexToken: this.lpToken.indexTokenAddress,
        longToken: longToken.address,
        shortToken: shortToken.address
      }


      return async (sourceAsset, targetAsset, amountIn) => {
        let gmxData;
        if (window.chain === 'arbitrum') {
          gmxData = await (await fetch(`https://${config.chainSlug}-api.gmxinfra.io/prices/tickers`)).json();
        } else {
          gmxData = JSON.parse('[{"tokenAddress":"0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB","tokenSymbol":"ETH","minPrice":"2376284700000000","maxPrice":"2376284700000000","updatedAt":1707272591518},{"tokenAddress":"0x152b9d0FdC40C096757F570A51E494bd4b943E50","tokenSymbol":"BTC","minPrice":"430397400000000000000000000","maxPrice":"430397400000000000000000000","updatedAt":1707272591119},{"tokenAddress":"0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7","tokenSymbol":"AVAX","minPrice":"34196331000000","maxPrice":"34196331000000","updatedAt":1707272589916},{"tokenAddress":"0x5947BB275c521040051D82396192181b413227A3","tokenSymbol":"LINK","minPrice":"18312430870000","maxPrice":"18312430870000","updatedAt":1707272589716},{"tokenAddress":"0xFE6B19286885a4F7F55AdAD09C3Cd1f906D2478F","tokenSymbol":"SOL","minPrice":"96820000000000000000000","maxPrice":"96820000000000000000000","updatedAt":1707272589516},{"tokenAddress":"0xC301E6fe31062C557aEE806cc6A841aE989A3ac6","tokenSymbol":"DOGE","minPrice":"788116000000000000000","maxPrice":"788116000000000000000","updatedAt":1707272589716},{"tokenAddress":"0x8E9C35235C38C44b5a53B56A41eaf6dB9a430cD6","tokenSymbol":"LTC","minPrice":"680795000000000000000000","maxPrice":"680795000000000000000000","updatedAt":1707272591722},{"tokenAddress":"0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E","tokenSymbol":"USDC","minPrice":"1000000000000000000000000","maxPrice":"1000198000000000000000000","updatedAt":1707272588361},{"tokenAddress":"0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664","tokenSymbol":"USDC.e","minPrice":"1000000000000000000000000","maxPrice":"1000198000000000000000000","updatedAt":1707272588361},{"tokenAddress":"0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7","tokenSymbol":"USDT","minPrice":"999259570000000000000000","maxPrice":"1000000000000000000000000","updatedAt":1707272588361},{"tokenAddress":"0xc7198437980c041c805A1EDcbA50c1Ce5db95118","tokenSymbol":"USDT.e","minPrice":"999259570000000000000000","maxPrice":"1000000000000000000000000","updatedAt":1707272588361},{"tokenAddress":"0xd586E7F844cEa2F87f50152665BCbc2C279D8d70","tokenSymbol":"DAI.e","minPrice":"999900000000","maxPrice":"1000000000000","updatedAt":1707272588361},{"tokenAddress":"0x34B2885D617cE2ddeD4F60cCB49809fc17bb58Af","tokenSymbol":"XRP","minPrice":"504763000000000000000000","maxPrice":"504763000000000000000000","updatedAt":1707272591518}]')
        }

        let shortTokenGmxData = gmxData.find(el => el.tokenSymbol === shortToken.symbol);
        let longTokenGmxData = gmxData.find(el => el.tokenSymbol === longToken.symbol);
        let indexTokenGmxData = gmxData.find(el => el.tokenAddress.toLowerCase() === this.lpToken.indexTokenAddress.toLowerCase());

        const prices = {
          indexTokenPrice: {
            min: BigNumber.from(indexTokenGmxData.minPrice),
            max: BigNumber.from(indexTokenGmxData.maxPrice)
          },
          longTokenPrice: {
            min: BigNumber.from(longTokenGmxData.minPrice),
            max: BigNumber.from(longTokenGmxData.maxPrice)
          },
          shortTokenPrice: {
            min: BigNumber.from(shortTokenGmxData.minPrice),
            max: BigNumber.from(shortTokenGmxData.maxPrice)
          }
        }

        if (config.GMX_V2_ASSETS_CONFIG[sourceAsset]) {
          let [longTokenOut, shortTokenOut] = await depositReader.getWithdrawalAmountOut(
              config.gmxV2DataStoreAddress, marketProps, prices, amountIn, this.nullAddress
          );

          return [longTokenOut, shortTokenOut];
        } else {
          let isLong = this.lpToken.longToken === sourceAsset;

          let amountOut = await depositReader.getDepositAmountOut(
              config.gmxV2DataStoreAddress, marketProps, prices, isLong ? amountIn : 0, isLong ? 0 : amountIn, this.nullAddress
          );

          return amountOut;
        }
      }
    },

    gmxV2DepositFee() {
      return async (sourceAsset, targetAsset, amountIn, amountOut) => {
        let isDeposit = targetAsset === this.lpToken.symbol;

        let firstAsset = isDeposit ? sourceAsset : targetAsset;
        let isLong = firstAsset === this.lpToken.longToken;
        const firstConfig = config.ASSETS_CONFIG[firstAsset];
        const secondAsset = isLong ? this.lpToken.shortToken : this.lpToken.longToken;
        const secondConfig = config.ASSETS_CONFIG[secondAsset];
        const firstERC20 = new ethers.Contract(firstConfig.address, erc20ABI, this.provider.getSigner());
        const secondERC20 = new ethers.Contract(secondConfig.address, erc20ABI, this.provider.getSigner());

        const firstTotalWorth = firstConfig.price * formatUnits(await firstERC20.balanceOf(this.lpToken.address), firstConfig.decimals);
        const secondTotalWorth = secondConfig.price * formatUnits(await secondERC20.balanceOf(this.lpToken.address), secondConfig.decimals);

        return toWei((firstTotalWorth > secondTotalWorth ? 0.0007 : 0.0005).toString());
      }
    },

    gmxV2WithdrawFee() {
      return async (sourceAsset, targetAsset, amountIn, amountOut) => {
        return toWei('0.0007');
      }
    },

    async calculateExecutionFee(isDeposit) {
      const dataStore = new ethers.Contract(config.gmxV2DataStoreAddress, IDATA_STORE.abi, this.provider.getSigner());

      //TODO: use multicall

      //TODO: withdraw check

      const estimatedGasLimit = isDeposit ?
          fromWei(await dataStore.getUint(this.depositGasLimitKey(true))) * 10 ** 18 + config.gmxV2DepositCallbackGasLimit
          :
          fromWei(await dataStore.getUint(hashData(["bytes32"], [WITHDRAWAL_GAS_LIMIT_KEY]))) * 10 ** 18 + config.gmxV2DepositCallbackGasLimit;

      let baseGasLimit = fromWei(await dataStore.getUint(ESTIMATED_GAS_FEE_BASE_AMOUNT)) * 10 ** 18;

      let multiplierFactor = formatUnits(await dataStore.getUint(ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR), 30);

      const adjustedGasLimit = baseGasLimit + estimatedGasLimit * multiplierFactor;

      const maxPriorityFeePerGas = (await provider.getFeeData()).maxPriorityFeePerGas.toNumber();
      let gasPrice = (await provider.getGasPrice()).toNumber();

      if (config.gmxV2UseMaxPriorityFeePerGas) gasPrice += maxPriorityFeePerGas;
      gasPrice *= (1 + config.gmxV2GasPriceBuffer);
      gasPrice += config.gmxV2GasPricePremium;


      const deltaPrimeMultiplicator = 1.5;

      return deltaPrimeMultiplicator * adjustedGasLimit * gasPrice / 10 ** 18;
    },

    async openAddFromWalletModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      modalInstance.asset = this.lpToken;
      modalInstance.assetBalance = this.gmxV2Balances && this.gmxV2Balances[this.lpToken.symbol] ? this.gmxV2Balances[this.lpToken.symbol] : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.farms = this.farms;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.loan = this.debt;
      modalInstance.thresholdWeightedValue = this.thresholdWeightedValue;
      modalInstance.isLP = false;
      modalInstance.logo = `${this.lpToken.symbol.toLowerCase()}.${this.lpToken.logoExt ? this.lpToken.logoExt : 'svg'}`;
      modalInstance.walletAssetBalance = await this.getWalletLpTokenBalance();
      modalInstance.reverseSwapDisabled = true;
      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
          const fundRequest = {
            value: addFromWalletEvent.value.toString(),
            asset: this.lpToken.symbol,
            assetDecimals: config.GMX_V2_ASSETS_CONFIG[this.lpToken.symbol].decimals,
            pid: this.lpToken.pid,
            type: 'GMX_V2',
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
      modalInstance.assetBalance = this.gmxV2Balances[this.lpToken.symbol];
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.farms = this.farms;
      modalInstance.health = this.health;
      modalInstance.isLP = false;
      modalInstance.logo = `${this.lpToken.symbol.toLowerCase()}.${this.lpToken.logoExt ? this.lpToken.logoExt : 'svg'}`;
      modalInstance.reverseSwapDisabled = true;
      modalInstance.$on('WITHDRAW', withdrawEvent => {
        const withdrawRequest = {
          value: withdrawEvent.value.toString(),
          asset: this.lpToken.symbol,
          assetDecimals: config.GMX_V2_ASSETS_CONFIG[this.lpToken.symbol].decimals,
          pid: this.lpToken.pid,
          type: 'GMX_V2',
        };
        this.handleTransaction(this.withdraw, {withdrawRequest: withdrawRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    async openProvideLiquidityModal() {
      const modalInstance = this.openModal(SwapModal);
      let initSourceAsset = this.lpToken.longToken;

      modalInstance.title = 'Create GMX V2 position';
      modalInstance.swapDex = 'GmxV2';
      modalInstance.swapDebtMode = false;
      modalInstance.slippageMargin = 0.1;
      modalInstance.sourceAsset = initSourceAsset;
      modalInstance.sourceAssetBalance = this.assetBalances[initSourceAsset];
      modalInstance.assets = {...this.assets};
      modalInstance.sourceAssets = [this.lpToken.shortToken, this.lpToken.longToken];
      modalInstance.targetAssetsConfig = config.GMX_V2_ASSETS_CONFIG;
      modalInstance.targetAssets = [this.lpToken.symbol];
      modalInstance.assetBalances = {...this.assetBalances, ...this.gmxV2Balances};
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = this.lpToken.symbol;
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.checkMarketDeviation = false;

      const executionFee = await calculateGmxV2ExecutionFee(
          config.gmxV2DataStoreAddress,
          config.gmxV2DepositCallbackGasLimit,
          config.gmxV2UseMaxPriorityFeePerGas,
          config.gmxV2GasPriceBuffer,
          config.gmxV2GasPricePremium,
          true);
      modalInstance.info = `<div>Execution fee: ${executionFee.toFixed(6)}${config.nativeToken}. Unused gas will be returned to your account.</div>`;


      const nativeBalance = parseFloat(ethers.utils.formatEther(await this.provider.getBalance(this.account)));

      modalInstance.customSourceValidators = [
        {
          validate: async (value) => {
            if (nativeBalance < executionFee) {
              return `Not enough ${config.nativeToken} to pay execution fee.`;
            }
          }
        }
      ]

      modalInstance.queryMethods = {
        GmxV2: this.gmxV2Query(),
      };

      modalInstance.feeMethods = {
        GmxV2: this.gmxV2DepositFee(),
      };

      modalInstance.initiate();


      modalInstance.$on('SWAP', swapEvent => {

        const addLiquidityRequest = {
          sourceAsset: swapEvent.sourceAsset,
          targetAsset: swapEvent.targetAsset,

          isLongToken: swapEvent.sourceAsset === this.lpToken.longToken,
          sourceAmount: swapEvent.sourceAmount,
          minGmAmount: swapEvent.targetAmount,
          executionFee: executionFee,
          method: `deposit${capitalize(this.lpToken.longToken)}${capitalize(this.lpToken.shortToken)}GmxV2`
        };

        this.handleTransaction(this.addLiquidityGmxV2, {addLiquidityRequest: addLiquidityRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    async openRemoveLiquidityModal() {
      const modalInstance = this.openModal(SwapToMultipleModal);
      modalInstance.title = 'Unwind GMX V2 position';
      modalInstance.swapDex = 'GmxV2';
      modalInstance.dexOptions = ['GmxV2'];
      modalInstance.userSlippage = 0.1;
      modalInstance.sourceAsset = this.lpToken.symbol;
      modalInstance.sourceAssetBalance = this.gmxV2Balances[this.lpToken.symbol];
      modalInstance.sourceAssetsConfig = config.GMX_V2_ASSETS_CONFIG;
      modalInstance.assets = this.assets;
      modalInstance.sourceAssets = {GmxV2: [this.lpToken.symbol]};
      modalInstance.targetAssets = {GmxV2: [this.lpToken.longToken, this.lpToken.shortToken]};
      modalInstance.assetBalances = {...this.assetBalances, ...this.gmxV2Balances};
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = this.lpToken.longToken;
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.targetAssetAmounts = [0, 0];

      // modalInstance.info = `info .`;
      modalInstance.queryMethods = {
        GmxV2: this.gmxV2Query(),
      };
      modalInstance.feeMethods = {
        GmxV2: this.gmxV2WithdrawFee(),
      };
      modalInstance.swapDex = 'GmxV2';

      const executionFee = await calculateGmxV2ExecutionFee(
          config.gmxV2DataStoreAddress,
          config.gmxV2DepositCallbackGasLimit,
          config.gmxV2UseMaxPriorityFeePerGas,
          config.gmxV2GasPriceBuffer,
          config.gmxV2GasPricePremium,
          false);
      modalInstance.info = `<div>Execution fee: ${executionFee.toFixed(6)}${config.nativeToken}. Unused gas will be returned to your account.</div>`;

      const nativeBalance = parseFloat(ethers.utils.formatEther(await this.provider.getBalance(this.account)));

      modalInstance.customSourceValidators = [
        {
          validate: async (value) => {
            if (nativeBalance < executionFee) {
              return `Not enough ${config.nativeToken} to pay execution fee.`;
            }
          }
        }
      ]

      modalInstance.initiate();

      modalInstance.$on('SWAP_TO_MULTIPLE', swapEvent => {

        const removeLiquidityRequest = {
          gmToken: swapEvent.sourceAsset,
          longToken: swapEvent.targetAssets[0],
          shortToken: swapEvent.targetAssets[1],
          gmAmount: swapEvent.sourceAmount,
          minLongAmount: swapEvent.targetAmounts[0],
          minShortAmount: swapEvent.targetAmounts[1],
          executionFee: executionFee,
          method: `withdraw${capitalize(this.lpToken.longToken)}${capitalize(this.lpToken.shortToken)}GmxV2`
        };

        this.handleTransaction(this.removeLiquidityGmxV2, {removeLiquidityRequest: removeLiquidityRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    openProfileModal() {
      const modalInstance = this.openModal(PartnerInfoModal);
      modalInstance.partner = {
        name: 'GMX V2',
        iconSrc: 'src/assets/logo/gmx.png',
        launchDate: moment(Date.parse('23 Nov 2022')).format('DD.MM.YYYY'),
        introduction: `GMX is the leading decentralized perpetual exchange available on Avalanche and Arbitrum allowing users to trade a number of different tokens with up to 50x leverage.<br><br>
            It helped to pioneer the real yield narrative, sharing protocol revenue between GMX, the native token, and GLP, their innovative liquidity providing token. Now with GMX 2.0, protocol revenue is shared with GM minters.<br><br>
            Since launch, it has attracted significant volume and liquidity, currently sitting in x position on [current chain] with $y in TVL. (NOTE: This should be changed based on the chain)`,
        banner: '',
        mainFeatures: [
          'Up to 50x leveraged synthetic trading',
          'Simple swaps for standard exchanges',
          'Strong focus on revenue sharing'
        ],
        securityMeasures: [
          {name: 'Upgradeability', state: 'ENABLED'},
          {name: 'Timelock (12h)', state: 'ENABLED'},
          {name: 'Multisig', state: 'ENABLED'},
          {
            name: `Audits `, state: 'ENABLED', tooltip:
                `
          `
          },
          {
            name: 'Doxxed team',
            state: 'DISABLED',
            tooltip: `The team is anonymous and has not performed KYC <br>with the DeltaPrime team.<br><br>`
          },
        ],
        chainImpact: `GMX has garnered significant attention since first launching, both for providing an excellent environment for traders to open leveraged positions, and for sharing significant protocol revenue with their liquidity providers.<br><br>
        Where initially the vast majority of protocol fees went to GLP minters (those who provided an index of assets to GMX v1), this now goes to GM minters. GM are liquidity providing tokens for GMX’s new synthetics protocol, which, due to its design, has minimal price divergence (usually known as slippage).<br><br>
        Through its popularity, GMX has attracted many new users as well as builders to both Avalanche and Arbitrum, significantly benefitting both chains over the past two years. GMX itself has since inception done over 130 billion dollars in volume.`,
        yieldCalculation: `GM accrues 63% of the fees collected in the v2 markets, with the remaining 27% being distributed to GMX holders. GM yield consists of two numbers: Base APR and Bonus APR.<br><br>
        The Base APR automatically compounds in the GM token itself. Where the value of GM is influenced by price-changes of the underlying assets, fees accumulated and counterparty PnL, the APR is influenced solely by the fees accumulated and counterparty PnL.<br><br>
        The Bonus APR are incentives. Incentives from the STIP are airdropped weekly to your Prime Account.`,
        chartData: [{x: new Date(), y: 5}, {x: new Date(), y: 15}, {x: new Date(), y: 25}, {
          x: new Date(),
          y: 20
        }, {x: new Date(), y: 15}, {x: new Date(), y: 25}, {x: new Date(), y: 5}]
      }
    },

    async setupPoolBalance() {
      const lpTokenContract = new ethers.Contract(this.lpToken.address, erc20ABI, this.provider.getSigner());
      this.poolBalance = fromWei(await lpTokenContract.totalSupply());
    },

    async setupRewards() {
      if (!this.smartLoanContract || !this.provider) return;

      this.rewards = fromWei(await farmingContract.pendingReward(this.lpToken.pid, this.smartLoanContract.address));

      this.rewardsInUsd = 0;
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
      this.healthService.observeHealth().subscribe(health => {
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
          this.gmxV2Balances[this.lpToken.symbol] = updateEvent.balance;
          this.isLpBalanceEstimated = !updateEvent.isTrueData;
          this.setupGmUnderlyingBalances();
          this.$forceUpdate();
        }
      })
    },

    watchAsset() {
      this.dataRefreshEventService.observeAssetUpdatedEvent().subscribe(asset => {
        if (asset.symbol === this.lpToken.symbol) this.lpToken = asset;
        this.$forceUpdate();
      });
    },

    watchAssetPricesUpdate() {
      this.priceService.observeRefreshPrices().subscribe((updateEvent) => {
        this.setupTvl();
      });
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

    async setupTvl() {
      const longConfig = config.ASSETS_CONFIG[this.lpToken.longToken];
      const shortConfig = config.ASSETS_CONFIG[this.lpToken.shortToken];
      const longERC20 = new ethers.Contract(longConfig.address, erc20ABI, this.provider.getSigner());
      const shortERC20 = new ethers.Contract(shortConfig.address, erc20ABI, this.provider.getSigner());

      const longTotalWorth = longConfig.price * formatUnits(await longERC20.balanceOf(this.lpToken.address), longConfig.decimals);
      const shortTotalWorth = shortConfig.price * formatUnits(await shortERC20.balanceOf(this.lpToken.address), shortConfig.decimals);

      this.tvl = longTotalWorth + shortTotalWorth;
    },

    depositGasLimitKey(singleToken) {
      return hashData(["bytes32", "bool"], [DEPOSIT_GAS_LIMIT_KEY, singleToken]);
    }
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
    grid-template-columns: repeat(2, 1fr) 240px 130px 100px 120px 100px 60px 80px 22px;
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

        .asset__icon {
          cursor: pointer;
        }

        .asset__icon {
          cursor: pointer;
          width: 20px;
          height: 20px;
          opacity: var(--asset-table-row__icon-opacity);
        }

        .asset__name {
          color: var(--default-text-color);
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

          a {
            cursor: pointer;
          }
        }
      }

      &.balance, &.trend-gmxV2, &.rewards {
        align-items: flex-end;
      }

      &.capacity, &.rewards {
        flex-direction: column;
        justify-content: center;
        align-items: flex-end;
      }

      &.composition {
        display: flex;
        align-items: center;
        justify-content: flex-end;

        .asset__icon {
          margin-left: 5px;
          height: 22px;
          width: 22px;
          border-radius: 50%;
          margin-right: 9px;
        }
      }

      &.rewards {
        .lvl-logo {
          width: 20px;
          height: 20px;
          opacity: var(--asset-table-row__icon-opacity);
        }
      }

      &.trend-gmxV2 {
        cursor: pointer;
        justify-content: center;
        align-items: center;
        margin-left: 66px;
      }

      &.apr, &.max-apr, &.tvl {
        align-items: flex-end;

        .stars-icon {
          width: 20px;
          margin-left: 2px;
          transform: translateY(-2px);
        }
      }

      &.apr {
        padding-right: 24px;
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

    .chart-toggles {
      position: relative;
      margin: -16px 0 16px 0;
      pointer-events: none;
      height: 28px;

      & > * {
        pointer-events: all;
      }
    }

    .chart-dropdown {
      position: absolute;
      width: 200px;
    }

    .chart-container__toggle {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
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
.gmxV2 {
  .table__row {
    .bar-gauge-beta-component .bar-gauge .bar {
      width: 80px;
    }
  }
}
</style>
