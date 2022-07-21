<template>
  <div v-if="asset" id="modal" class="repay-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Repay
      </div>

      <CurrencyInput :symbol="asset.symbol" v-on:newValue="repayValueChange" :max="asset.balance"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after confirmation:
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
              Loan:
            </div>
            <div class="summary__value">
              {{ loan - repayValue | smartRound }} {{ asset.symbol }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Repay'" v-on:click="submit()"></Button>
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
  name: 'WithdrawModal',
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

  },

  data() {
    return {
      repayValue: 0,
      ltvAfterTransaction: 0,
      loan: 0,
    }
  },

  mounted() {
    setTimeout(() => {
      this.loan = this.totalCollateral * this.ltv;
      this.calculateLTVAfterTransaction();
    })
  },

  methods: {
    submit() {
      this.$emit('REPAY', this.repayValue);
    },


    repayValueChange(event) {
      this.repayValue = event.value;
    },

    calculateLTVAfterTransaction() {
      if (this.repayValue) {
        this.ltvAfterTransaction = (this.loan - (this.repayValue * this.asset.price)) / this.totalCollateral;
      } else {
        this.ltvAfterTransaction = this.ltv;
      }
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";
</style>