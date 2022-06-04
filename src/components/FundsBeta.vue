<template>
  <div class="funds-beta-component">
    <button v-on:click="testModal()">test modal</button>
    <div class="funds">
      <NameValueBadgeBeta :name="'Value of available funds'">{{ 1243.36 | usd }}</NameValueBadgeBeta>
      <div class="funds-table">
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
          <FundTableRowBeta></FundTableRowBeta>
          <FundTableRowBeta></FundTableRowBeta>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import NameValueBadgeBeta from './NameValueBadgeBeta';
import config from '../config';
import FundTableRowBeta from './FundTableRowBeta';
import BorrowModal from './BorrowModal';

export default {
  name: 'FundsBeta',
  components: {FundTableRowBeta, NameValueBadgeBeta},
  computed: {
    funds() {
      return config.ASSETS_CONFIG;
    }
  },
  methods: {
    testModal() {
      this.openModal(BorrowModal);
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