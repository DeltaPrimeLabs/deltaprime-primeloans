<template>
  <div id="modal" class="pool-withdraw-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Withdraw
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ apy | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Deposit:</div>
        <div class="top-info__value">{{ deposit | smartRound }}<span class="top-info__currency">AVAX</span></div>
      </div>

      <CurrencyInput :symbol="assetSymbol" v-on:newValue="withdrawValueChange" :max="Number(deposit)"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            <div class="pool">
              <img v-if="assetSymbol === 'AVAX'" class="pool__icon" src="src/assets/logo/avax.svg">
              <img v-if="assetSymbol === 'USDC'" class="pool__icon" src="src/assets/logo/usdc.svg">
              <div class="pool__name">{{ assetSymbol }} Pool</div>
              ,
            </div>
            Values after confirmation:
          </div>
          <div class="summary__values">
            <div class="summary__label">
              Deposit:
            </div>
            <div class="summary__value">
              {{ deposit - withdrawValue > 0 ? deposit - withdrawValue : 0 | smartRound }} <span class="currency">AVAX</span>
            </div>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Daily interest ≈
            </div>
            <div class="summary__value">
              {{ calculateDailyInterest | smartRound }} <span class="currency">AVAX</span>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Deposit'" v-on:click="submit()"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import CurrencyInput from './CurrencyInput';
import Button from './Button';

export default {
  name: 'PoolWithdrawModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal
  },

  props: {
    apy: null,
    available: null,
    deposit: null,
    assetSymbol: null,
  },

  data() {
    return {
      withdrawValue: 0,
    }
  },

  computed: {
    calculateDailyInterest() {
      const value = this.deposit - this.withdrawValue;
      if (value > 0) {
        return this.apy / 365 * value;
      } else {
        return 0;
      }
    }
  },

  methods: {
    submit() {
      this.$emit('WITHDRAW', this.withdrawValue);
    },


    withdrawValueChange(event) {
      this.withdrawValue = event.value;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

</style>