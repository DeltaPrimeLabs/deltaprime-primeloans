<template>
  <div id="modal" class="deposit-modal-component modal-component">
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

      <CurrencyInput :symbol="'AVAX'" v-on:newValue="withdrawValueChange" :max="deposit"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            <div class="pool">
              <img class="pool__icon" src="src/assets/logo/avax.svg">
              <div class="pool__name">AVAX Pool</div>
              ,
            </div>
            Values after confirmation:
          </div>
          <div class="summary__values">
            <div class="summary__label">
              Deposit:
            </div>
            <div class="summary__value">
              {{ deposit - withdrawValue | smartRound }} <span class="currency">AVAX</span>
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
  },

  data() {
    return {
      withdrawValue: 0,
    }
  },

  computed: {
    calculateDailyInterest() {
      return this.apy / 365 * (this.deposit - this.withdrawValue);
    }
  },

  methods: {
    submit() {
      this.$emit('WITHDRAW', this.withdrawValue);
    },


    withdrawValueChange(event) {
      console.log(event.value);
      this.withdrawValue = event.value;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.summary__title {
  .pool {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-right: 5px;

    .pool__icon {
      height: 22px;
      width: 22px;
      border-radius: 50%;
      margin-right: 9px;
    }

    .pool__name {
      font-weight: 600;
      color: black;
    }
  }
}

</style>