<template>
  <div v-if="asset" id="modal" class="withdraw-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Withdraw
      </div>

      <CurrencyInput :symbol="'AVAX'" v-on:newValue="withdrawValueChange" :max="Number(asset.balance)"></CurrencyInput>

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
              Balance:
            </div>
            <div class="summary__value">
              {{ asset.balance - withdrawValue | smartRound }} {{ asset.symbol }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Withdraw'" v-on:click="submit()"></Button>
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
      withdrawValue: 0,
      ltvAfterTransaction: 0,
    }
  },

  mounted() {
    setTimeout(() => {
      this.calculateLTVAfterTransaction();
    })
  },

  methods: {
    submit() {
      this.$emit('WITHDRAW', this.withdrawValue);
    },


    withdrawValueChange(event) {
      this.withdrawValue = event.value;
    },

    calculateLTVAfterTransaction() {
      if (this.withdrawValue) {
        const loan = this.totalCollateral * this.ltv;
        this.ltvAfterTransaction = (loan + (this.withdrawValue * this.asset.price)) / this.totalCollateral;
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