<template>
  <div class="funds-beta-component">
<!--    <button v-on:click="fundClick()">fund</button>
    <button v-on:click="borrowClick()">borrow</button>
    <button v-on:click="wavaxSwap()">WavaxSwap</button>
    <button v-on:click="createLoanClick()">create loan</button>
    <button v-on:click="createAndFundLoanClick()">create and fund loan</button>
    <button v-on:click="testLoanClick()">test loan</button>
    <button v-on:click="depositClick()">deposit</button>
    <button v-on:click="getAllAssetsBalancesClick()">balances</button>
    <button v-on:click="testModal()">test swap</button>-->
    <div class="funds">
      <NameValueBadgeBeta v-if="calculateAvailableValue" :name="'Value of available funds'">{{ calculateAvailableValue | usd }}</NameValueBadgeBeta>
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
          <FundTableRowBeta v-for="(asset, index) in funds" v-bind:key="asset.symbol" :asset="asset" :balance="assetBalances[index]"></FundTableRowBeta>
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
import {mapState, mapActions} from 'vuex';
import redstone from 'redstone-api';
import Vue from 'vue';
import Loader from './Loader';
import {fromWei, formatUnits} from '../utils/calculate';
import SwapModal from './SwapModal';


export default {
  name: 'FundsBeta',
  components: {Loader, FundTableRowBeta, NameValueBadgeBeta},
  data() {
    return {
      funds: config.ASSETS_CONFIG,
    }
  },
  computed: {
    ...mapState('fundsStore', ['assets', 'assetBalances']),
    calculateAvailableValue() {
      if (this.funds) {
        let availableValue = 0;
        Object.values(this.funds).forEach(asset => {
          availableValue += asset.balance * asset.price;
        });
        return availableValue;
      }
    }
  },
  methods: {
    ...mapActions('fundsStore', ['fund', 'borrow', 'swapToWavax', 'createLoan', 'createAndFundLoan', 'setupSmartLoanContract', 'getAllAssetsBalances']),
    ...mapActions('poolStore', ['deposit']),
    fundClick() {
      this.fund();
    },

    borrowClick() {
      this.borrow();
    },

    wavaxSwap() {
      this.swapToWavax();
    },

    createLoanClick() {
      this.createLoan();
    },

    createAndFundLoanClick() {
      this.createAndFundLoan();
    },

    testLoanClick() {
      this.setupSmartLoanContract();
    },

    depositClick() {
      this.deposit();
    },

    testModal() {
      const swapModalInstance = this.openModal(SwapModal);
      swapModalInstance.sourceAsset = 'BTC';
      swapModalInstance.targetAsset = 'AVAX';
    },

    getAllAssetsBalancesClick() {
      this.getAllAssetsBalances();
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
      console.log(funds);
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
                const balance = formatUnits(this.assetBalances[index], config.ASSETS_CONFIG[symbol].decimals);
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