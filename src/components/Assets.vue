<template>
  <div class="funds-beta-component">
    <!--    <button v-on:click="swapToWavax">wavax</button>-->
    <!--    <div class="only-my-assets-checkbox">-->
    <!--      <Checkbox :label="'Show only my assets'"></Checkbox>-->
    <!--    </div>-->
    <div class="funds">
      <NameValueBadgeBeta class="total-value" :name="'Total value'">
        {{ (fullLoanStatus.totalValue ? fullLoanStatus.totalValue : 0) | usd }}
      </NameValueBadgeBeta>
      <div class="funds-table" v-if="funds">
        <TableHeader :config="fundsTableHeaderConfig"></TableHeader>
        <div class="funds-table__body">
          <!-- TODO: referring to index is pretty risky -->
          <AssetsTableRow v-for="(asset) in funds" v-bind:key="asset.symbol" :asset="asset"></AssetsTableRow>
        </div>
      </div>
      <div class="loader-container" v-if="!funds">
        not funds
        <VueLoadersBallBeat color="#A6A3FF" scale="1.5"></VueLoadersBallBeat>
      </div>
    </div>
  </div>
</template>

<script>
import NameValueBadgeBeta from './NameValueBadgeBeta';
import config from '../config';
import AssetsTableRow from './AssetsTableRow';
import {mapActions, mapState} from 'vuex';
import redstone from 'redstone-api';
import Vue from 'vue';
import Loader from './Loader';
import {formatUnits} from '../utils/calculate';
import TableHeader from './TableHeader';
import AssetFilter from './AssetFilter';
import DoubleAssetIcon from './DoubleAssetIcon';
import Paginator from './Paginator';
import Checkbox from './Checkbox';
import DexFilter from './DexFilter';

export default {
  name: 'Assets',
  components: {
    DexFilter,
    Checkbox,
    Paginator,
    DoubleAssetIcon, AssetFilter, TableHeader, Loader, AssetsTableRow, NameValueBadgeBeta,
  },
  data() {
    return {
      funds: null,
      selectedDexes: [] = [],
      fundsTableHeaderConfig: null,
      lpAssetsFilterOptions: null,
      lpDexFilterOptions: null,
    };
  },
  computed: {
    ...mapState('fundsStore', ['assets', 'fullLoanStatus', 'lpAssets', 'assetBalances', 'smartLoanContract', 'noSmartLoan']),
  },
  watch: {
    assets: {
      handler(updatedAssets) {
        this.updateAssetsData(updatedAssets);
      },
      immediate: true
    },
  },
  mounted() {
    this.funds = config.ASSETS_CONFIG;
    this.setupFundsTableHeaderConfig();
  },
  methods: {
    ...mapActions('fundsStore',
      [
        'fund',
        'borrow',
        'swapToWavax',
        'createLoan',
        'createAndFundLoan',
        'setupSmartLoanContract',
        'getAllAssetsBalances',
        'setAvailableAssetsValue',
        'updateFunds'
      ]),
    ...mapActions('poolStore', ['deposit']),

    updateFund(symbol, key, value) {
      Vue.set(this.funds[symbol], key, value);
    },

    chartPoints(points) {
      if (points == null || points.length === 0) {
        return [];
      }

      let maxValue = 0;
      let minValue = points[0].value;

      let dataPoints = points.map(
        item => {
          if (item.value > maxValue) maxValue = item.value;

          if (item.value < minValue) minValue = item.value;

          return {
            x: item.timestamp,
            y: item.value
          };
        }
      );

      return [dataPoints, minValue, maxValue];
    },

    async updateAssetsData(funds) {
      this.funds = funds;

      if (funds) {
        Object.keys(funds).forEach((symbol, index) => {
          redstone.getHistoricalPrice(symbol, {
            startDate: Date.now() - 3600 * 1000 * 24,
            interval: 600 * 1000,
            endDate: Date.now(),
            provider: 'redstone-avalanche'
          }).then(
            (response) => {

              const [prices, minPrice, maxPrice] = this.chartPoints(
                response
              );

              this.updateFund(symbol, 'prices', prices);
              this.updateFund(symbol, 'minPrice', minPrice);
              this.updateFund(symbol, 'maxPrice', maxPrice);
              if (this.assetBalances && this.assetBalances[index]) {
                const balance = formatUnits(this.assetBalances[index].balance, config.ASSETS_CONFIG[symbol].decimals);
                if (balance > 0) {
                  this.updateFund(symbol, 'balance', balance);
                } else {
                  this.updateFund(symbol, 'balance', null);
                }
              }
            }
          );
        });
      }
    },
    setupFundsTableHeaderConfig() {
      this.fundsTableHeaderConfig = {
        gridTemplateColumns: 'repeat(6, 1fr) 90px 76px 102px',
        cells: [
          {
            label: 'Asset',
            sortable: false,
            class: 'asset',
            id: 'ASSET',
            tooltip: `The asset name. These names are simplified for a smoother UI.
                                       <a href='https://docs.deltaprime.io/integrations/tokens' target='_blank'>More information</a>.`
          },
          {
            label: 'Balance',
            sortable: false,
            class: 'balance',
            id: 'BALANCE',
            tooltip: `The number and value of unstaked assets in your Prime Account.`
          },
          {
            label: 'Farmed',
            sortable: false,
            class: 'farmed',
            id: 'FARMED',
            tooltip: `The number and value of staked assets in your Prime Account.`
          },
          {
            label: 'Borrowed',
            sortable: false,
            class: 'loan',
            id: 'LOAN',
            tooltip: `The amount/value of tokens borrowed. Shows a '-' if tokens can't be borrowed.<br>
                      In order to withdraw to your wallet, the number in "balance" needs to be equal or higher than the number in "borrowed".<br>
                      <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/exchange#borrowed' target='_blank'>More information</a>.`
          },
          {
            label: 'Power',
            sortable: false,
            class: 'impact',
            id: 'IMPACT',
            tooltip: `How much you can borrow against this asset`,
          },
          {
            label: 'Trend (24h)',
            sortable: false,
            class: 'trend',
            id: 'TREND'
          },
          {
            label: 'Price',
            sortable: false,
            class: 'price',
            id: 'PRICE'
          },
          {
            label: '',
          },
          {
            label: 'Actions',
            class: 'actions',
            id: 'ACTIONS',
            tooltip: `The different actions you can perform with this asset. <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/exchange#actions' target='_blank'>More information</a>`
          },
        ]
      };
    },
  },
};
</script>


<style lang="scss" scoped>
@import "~@/styles/variables";


.funds-beta-component {
  width: 100%;

  .only-my-assets-checkbox {
    position: absolute;
    top: 24px;
    right: 30px;
  }

  .funds {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 23px;

    .total-value {
      margin-bottom: 57px;
    }

    .funds-table {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .funds-table__body {
      display: flex;
      flex-direction: column;
    }

    .loader-container {
      margin-top: 40px;
    }
  }
}
</style>
