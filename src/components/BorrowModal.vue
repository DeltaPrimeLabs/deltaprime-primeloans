<template>
  <div v-if="asset" id="modal" class="borrow-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Borrow
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ loanAPY | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Available in pool:</div>
        <div class="top-info__value">{{poolTVL}}<span class="top-info__currency">{{ asset.symbol }}</span></div>
      </div>

      <CurrencyInput :symbol="asset.symbol" v-on:inputChange="inputChange"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__values">
            <div class="summary__label">
              LTV:
            </div>
            <div class="summary__value">
              {{ ltvAfterTransaction | percent }}
            </div>
            <BarGaugeBeta :min="0" :max="5" :value="ltvAfterTransaction" :slim="true"></BarGaugeBeta>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Balance:
            </div>
            <div class="summary__value">
              {{ asset.balance + value | smartRound }} {{ asset.symbol }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Borrow'" v-on:click="submit()"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import CurrencyInput from './CurrencyInput';
import Button from './Button';
import BarGaugeBeta from './BarGaugeBeta';

export default {
  name: 'BorrowModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {
    asset: {},
    ltv: {},
    totalCollateral: {},
    loanAPY: {},
    poolTVL: {},
    maxLTV: {}
  },

  data() {
    return {
      value: 0,
      ltvAfterTransaction: 0,
    };
  },

  mounted() {
    setTimeout(() => {
      this.calculateLTVAfterTransaction();
    })
  },

  methods: {
    submit() {
      this.$emit('BORROW', this.value);
    },

    inputChange(change) {
      this.value = change;
      console.log(this.value);
      this.calculateLTVAfterTransaction();
    },

    calculateLTVAfterTransaction() {
      console.log(this.ltv);
      if (this.value) {
        const loan = this.totalCollateral * this.ltv;
        this.ltvAfterTransaction = (loan + (this.value * this.asset.price)) / this.totalCollateral;
      } else {
        this.ltvAfterTransaction = this.ltv;
      }
    },

    calculateMaxBorrowAmount() {

    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";


</style>