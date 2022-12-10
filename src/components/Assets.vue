<template>
  <div class="funds-beta-component">
    <!--    <button v-on:click="swapToWavax">wavax</button>-->
    <!--    <div class="only-my-assets-checkbox">-->
    <!--      <Checkbox :label="'Show only my assets'"></Checkbox>-->
    <!--    </div>-->
    <div class="funds">
      <!--      <NameValueBadgeBeta :name="'Total value'">{{ (fullLoanStatus.totalValue ? fullLoanStatus.totalValue : 0) | usd }}</NameValueBadgeBeta>-->
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
    <div class="lp-tokens">
      <div class="filters" v-if="assetFilterGroups">
        <AssetFilter ref="assetFilter" :asset-filter-groups="assetFilterGroups"
                     v-on:filterChange="setLpFilter"></AssetFilter>
      </div>
      <div class="lp-table" v-if="lpTokens && filteredLpTokens">
        <TableHeader :config="lpTableHeaderConfig"></TableHeader>
        <LpTableRow v-for="(lpToken, index) in filteredLpTokens" v-bind:key="index" :lp-token="lpToken">{{ lpToken }}
        </LpTableRow>
        <!--        <div class="paginator-container">-->
        <!--          <Paginator :total-elements="50" :page-size="6"></Paginator>-->
        <!--        </div>-->
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
import LpTableRow from './LpTableRow';
import Paginator from './Paginator';
import Checkbox from './Checkbox';
import DexFilter from './DexFilter';

export default {
  name: 'Assets',
  components: {
    DexFilter,
    Checkbox,
    Paginator,
    LpTableRow, DoubleAssetIcon, AssetFilter, TableHeader, Loader, AssetsTableRow, NameValueBadgeBeta
  },
  data() {
    return {
      funds: null,
      lpTokens: config.LP_ASSETS_CONFIG,
      selectedLpTokens: [] = [],
      selectedDexes: [] = [],
      fundsTableHeaderConfig: null,
      lpTableHeaderConfig: null,
      lpAssetsFilterOptions: null,
      lpDexFilterOptions: null,
      assetFilterGroups: null,
    };
  },
  computed: {
    ...mapState('fundsStore', ['assets', 'fullLoanStatus', 'lpAssets', 'assetBalances', 'smartLoanContract', 'noSmartLoan']),
    filteredLpTokens() {
      return Object.values(this.lpTokens).filter(token =>
        (this.selectedLpTokens.includes(token.primary) || this.selectedLpTokens.includes(token.secondary))
        && this.selectedDexes.includes(token.dex)
      );
    },
  },
  watch: {
    assets: {
      handler(updatedAssets) {
        this.updateAssetsData(updatedAssets);
      },
      immediate: true
    },
    funds: {
      handler() {
        this.updateLpPriceData();
      },
      immediate: true
    },
  },
  mounted() {
    this.funds = config.ASSETS_CONFIG;
    this.setupFundsTableHeaderConfig();
    this.setupLpTableHeaderConfig();
    this.setupAssetFilterGroups();
    this.updateLpPriceData();
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

    async updateLpPriceData() {
      //TODO: we have to make sure somehow that it's called in a right moment ->when funds have prices already
      if (this.funds) {
        Object.keys(this.lpTokens).forEach(
          key => {
            const lpToken = this.lpTokens[key];
            lpToken.firstPrice = this.funds[lpToken.primary].price;
            lpToken.secondPrice = this.funds[lpToken.secondary].price;
          }
        );
      }
    },

    setupFundsTableHeaderConfig() {
      this.fundsTableHeaderConfig = {
        gridTemplateColumns: 'repeat(6, 1fr) 76px 102px',
        cells: [
          {
            label: 'Asset',
            sortable: false,
            class: 'asset',
            id: 'ASSET'
          },
          {
            label: 'Balance',
            sortable: false,
            class: 'balance',
            id: 'BALANCE'
          },
          {
            label: 'Borrowed',
            sortable: false,
            class: 'loan',
            id: 'LOAN'
          },
          {
            label: 'Impact',
            sortable: false,
            class: 'impact',
            id: 'IMPACT',
            tooltip: 'impact tooltip'
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
            id: 'ACTIONS'
          },
        ]
      };
    },

    setupLpTableHeaderConfig() {
      this.lpTableHeaderConfig = {
        gridTemplateColumns: '20% 1fr 20% 1fr 76px 102px',
        cells: [
          {
            label: 'LP Token',
            sortable: false,
            class: 'token',
            id: 'TOKEN'
          },
          {
            label: 'Balance',
            sortable: false,
            class: 'balance',
            id: 'BALANCE'
          },
          {
            label: 'TVL',
            sortable: false,
            class: 'balance',
            id: 'tvl'
          },
          {
            label: 'APR',
            sortable: false,
            class: 'apr',
            id: 'APR'
          },
          {
            label: ''
          },
          {
            label: 'Actions',
            class: 'actions',
            id: 'ACTIONS'
          },
        ]
      };
    },

    setupAssetFilterGroups() {
      this.assetFilterGroups = [
        {
          label: 'Filter by assets',
          options: ['AVAX', 'USDC', 'BTC', 'ETH', 'USDT', 'LINK', 'sAVAX'],
          key: 'asset'
        },
        {
          label: 'Filter by DEX',
          options: ['Pangolin', 'TraderJoe'],
          key: 'dex',
        }
      ];

      this.selectedLpTokens = this.assetFilterGroups[0].options;
      this.selectedDexes = this.assetFilterGroups[1].options;
      setTimeout(() => {
        this.$refs.assetFilter.assetFilterGroups = this.assetFilterGroups;
        this.$refs.assetFilter.setupFilterValue();
      });
    },

    setLpFilter(filter) {
      this.selectedLpTokens = filter.asset;
      this.selectedDexes = filter.dex;
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
    margin-top: 35px;

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

  .lp-tokens {
    display: flex;
    flex-direction: column;
    margin-top: 68px;

    .lp-table {

      .paginator-container {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        margin-top: 12px;
      }
    }
  }
}
</style>