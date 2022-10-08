<template>
  <div class="funds-beta-component">
    <div class="only-my-assets-checkbox">
      <Checkbox :label="'Show only my assets'"></Checkbox>
    </div>
    <div class="funds">
      <NameValueBadgeBeta :name="'Total value'">{{ (fullLoanStatus.totalValue ? fullLoanStatus.totalValue : 0) | usd }}</NameValueBadgeBeta>
      <div class="funds-table" v-if="funds">
        <TableHeader :config="fundsTableHeaderConfig"></TableHeader>
        <div class="funds-table__body">
          <!-- TODO: referring to index is pretty risky -->
          <AssetsTableRow v-for="(asset) in funds" v-bind:key="asset.symbol" :asset="asset"></AssetsTableRow>
        </div>
      </div>
      <div class="loader-container" v-if="!funds">
        <VueLoadersBallBeat color="#A6A3FF" scale="1.5"></VueLoadersBallBeat>
      </div>
    </div>
    <div class="lp-tokens">
      <div class="filter-container">
        <div class="filter__label">Filter by:</div>
        <AssetFilter :asset-options="assetsFilterOptions"></AssetFilter>
      </div>
      <div class="lp-table" v-if="lpTokens">
        <TableHeader :config="lpTableHeaderConfig"></TableHeader>
        <LpTableRow v-for="(lpToken, index) in lpTokens" v-bind:key="index" :lp-token="lpToken"></LpTableRow>
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
import BorrowModal from './BorrowModal';
import {mapState, mapActions} from 'vuex';
import redstone from 'redstone-api';
import Vue from 'vue';
import Loader from './Loader';
import {fromWei, formatUnits} from '../utils/calculate';
import SwapModal from './SwapModal';
import {fetchCollateralFromPayments} from '../utils/graph';
import TableHeader from './TableHeader';
import AssetFilter from './AssetFilter';
import DoubleAssetIcon from './DoubleAssetIcon';
import LpTableRow from './LpTableRow';
import Paginator from './Paginator';
import Checkbox from './Checkbox';


export default {
  name: 'Assets',
  components: {
    Checkbox,
    Paginator,
    LpTableRow, DoubleAssetIcon, AssetFilter, TableHeader, Loader, AssetsTableRow, NameValueBadgeBeta},
  data() {
    return {
      funds: config.ASSETS_CONFIG,
      lpTokens: config.LP_ASSETS_CONFIG,
      fundsTableHeaderConfig: null,
      lpTableHeaderConfig: null,
      assetsFilterOptions: null,
    }
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
    funds: {
      handler() {
        this.updateLpPriceData();
      },
      immediate: true
    },
  },
  mounted() {
    this.setupFundsTableHeaderConfig();
    this.setupLpTableHeaderConfig();
    this.setupAssetsFilterOptions();
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
        'getDebts',
        'setAvailableAssetsValue',
        'updateFunds'
      ]),
    ...mapActions('poolStore', ['deposit']),
    fundClick() {
      this.fund();
    },

    borrowClick() {
      this.borrow();
    },

    createLoanClick() {
      this.createLoan();
    },

    createAndFundLoanClick() {
      this.createAndFundLoan();
    },

    depositClick() {
      this.deposit();
    },

    getAllAssetsBalancesClick() {
      this.getAllAssetsBalances();
    },

    debts() {
      this.getDebts();
    },

    update() {
      this.updateFunds();
    },


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
            startDate: Date.now() - 3600 * 1000 * 24 * 7,
            interval: 3600 * 1000,
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
        })
      }
    },

    async updateLpPriceData() {
      //TODO: we have to make sure somehow that it's called in a right moment ->when funds have prices already
      Object.keys(this.lpTokens).forEach(
          key => {
            const lpToken = this.lpTokens[key];
            lpToken.firstPrice = this.funds[lpToken.primary].price;
            lpToken.secondPrice = this.funds[lpToken.secondary].price;
          }
      );
    },

    setupFundsTableHeaderConfig() {
      this.fundsTableHeaderConfig = {
        gridTemplateColumns: 'repeat(3, 1fr) 20% 1fr 76px 102px',
        cells: [
          {
            label: 'Asset',
            sortable: true,
            class: 'asset',
            id: 'ASSET'
          },
          {
            label: 'Balance',
            sortable: true,
            class: 'balance',
            id: 'BALANCE'
          },
          {
            label: 'Loan',
            sortable: true,
            class: 'loan',
            id: 'LOAN'
          },
          {
            label: 'Trend (24h)',
            sortable: true,
            class: 'trend',
            id: 'TREND'
          },
          {
            label: 'Price',
            sortable: true,
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
      }
    },

    setupLpTableHeaderConfig() {
      this.lpTableHeaderConfig = {
        gridTemplateColumns: '20% repeat(2, 1fr) 20% 1fr 76px 102px',
        cells: [
          {
            label: 'LP Token',
            sortable: true,
            class: 'token',
            id: 'TOKEN'
          },
          {
            label: 'Balance',
            sortable: true,
            class: 'balance',
            id: 'BALANCE'
          },
          {
            label: 'APR',
            sortable: true,
            class: 'apr',
            id: 'APR'
          },
          {
            label: 'Share',
            sortable: true,
            class: 'trend',
            id: 'TREND'
          },
          {
            label: 'Price',
            sortable: true,
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
      }
    },

    setupAssetsFilterOptions() {
      this.assetsFilterOptions = ['AVAX', 'USDC', 'BTC', 'ETH', 'USDT', 'LINK', 'QI'];
    }
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
      margin-top: 65px;
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

    .filter-container {
      display: flex;
      flex-direction: row;
      align-items: center;
      margin-bottom: 10px;

      .filter__label {
        font-size: $font-size-xsm;
        color: $medium-gray;
        font-weight: 600;
        margin-right: 12px;
      }
    }

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