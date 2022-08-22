<template>
  <div id="modal" class="deposit-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Deposit
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ apy | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Available:</div>
        <div class="top-info__value">{{ available | smartRound }}<span class="top-info__currency">AVAX</span></div>
      </div>

      <CurrencyInput :symbol="assetSymbol" v-on:newValue="depositValueChange" :max="Number(available)"></CurrencyInput>

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
              {{ deposit + depositValue | smartRound }} <span class="currency">AVAX</span>
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
  name: 'DepositModal',
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
      depositValue: 0,
    }
  },

  computed: {
    calculateDailyInterest() {
      return this.apy / 365 * (this.deposit + this.depositValue);
    }
  },

  methods: {
    submit() {
      this.$emit('DEPOSIT', this.depositValue);
    },


    depositValueChange(event) {
      this.depositValue = event.value;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

</style>