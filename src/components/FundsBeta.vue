<template>
  <div class="funds-beta-component">
    <div class="funds">
      <NameValueBadgeBeta v-if="availableValue" :name="'Value of available funds'">{{ availableValue | usd }}</NameValueBadgeBeta>
      <div class="funds-table" v-if="funds">
        <div class="funds-table__header">
          <div class="header__cell asset">Asset</div>
          <div class="header__cell balance">Balance</div>
          <div class="header__cell loan">Loan</div>
          <div class="header__cell trend">Trend (24h)</div>
          <div class="header__cell price">Price</div>
          <div></div>
          <div class="header__cell actions">Actions</div>
        </div>
        <div class="funds-table__body">
          <FundTableRowBeta v-for="asset in funds" v-bind:key="asset.symbol" :asset="asset"></FundTableRowBeta>
        </div>
      </div>
      <div v-if="!funds">
        <VueLoadersBallBeat color="#A6A3FF" scale="1.5"></VueLoadersBallBeat>
      </div>
    </div>

  </div>
</template>

<script>
import NameValueBadgeBeta from './NameValueBadgeBeta';
import config from '../config';
import FundTableRowBeta from './FundTableRowBeta';
import BorrowModal from './BorrowModal';
import {mapState} from 'vuex';
import redstone from 'redstone-api';
import Vue from 'vue';
import Loader from './Loader';

export default {
  name: 'FundsBeta',
  components: {Loader, FundTableRowBeta, NameValueBadgeBeta},
  data() {
    return {
      funds: config.ASSETS_CONFIG,
      availableValue: 0,
    }
  },
  computed: {
    ...mapState('loan', ['totalValue', 'assets']),
  },
  methods: {
    testModal() {
      const modalInstance = this.openModal(BorrowModal);
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

    async updateFunds(funds) {
      this.funds = funds;

      if (funds) {
        for (const symbol of Object.keys(funds)) {
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
            }
          );
        }
      }

      this.calculateAvailableValue();
    },

    calculateAvailableValue() {
      if (this.funds) {
        this.availableValue = 0;
        Object.values(this.funds).forEach(asset => {
          this.availableValue += asset.balance * asset.price;
        });
      }
    }
  },
  watch: {
    assets: {
      handler(newFunds) {
        this.updateFunds(newFunds);
      },
      immediate: true
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";


.funds-beta-component {
  width: 100%;

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

    .funds-table__header {
      display: grid;
      grid-template-columns: repeat(3, 1fr) 20% 1fr 76px 102px;
      border-style: solid;
      border-width: 0 0 2px 0;
      border-image-source: linear-gradient(to right, #dfe0ff 43%, #ffe1c2 62%, #ffd3e0 79%);
      border-image-slice: 1;
      padding: 0 0 9px 6px;

      .header__cell {
        display: flex;
        flex-direction: row;
        font-size: $font-size-xsm;
        color: $dark-gray;
        font-weight: 500;

        &.asset {
        }

        &.balance {
          justify-content: flex-end;
        }

        &.loan {
          justify-content: flex-end;
        }

        &.trend {
          justify-content: center;
          margin-left: 40px;
        }

        &.price {
          justify-content: flex-end;
        }

      }
    }

    .funds-table__body {
      display: flex;
      flex-direction: column;
    }
  }
}
</style>