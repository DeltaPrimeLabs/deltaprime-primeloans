<template>
  <div v-if="asset" id="modal" class="unstake-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Unstake
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ apy | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Staked:</div>
        <div class="top-info__value">{{ staked | smartRound }}<span class="top-info__currency">AVAX</span></div>
      </div>

      <CurrencyInput :symbol="asset.symbol" v-on:newValue="unstakeValueChange"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            <div class="protocol">
              <img class="protocol__icon" src="src/assets/logo/yak.svg">
              <div class="protocol__name">Yak protocol</div>
              ,
            </div>
            Values after confirmation:
          </div>
          <div class="summary__values">
            <div class="summary__label">
              Staked:
            </div>
            <div class="summary__value">
              {{ staked - unstakeValue > 0 ? staked - unstakeValue : 0 | smartRound }} <span class="currency">AVAX</span>
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
        <Button :label="'Unstake'" v-on:click="submit()"></Button>
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
  name: 'StakeModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal
  },

  props: {
    apy: {},
    available: {},
    staked: {},
    asset: {}
  },

  data() {
    return {
      unstakeValue: 0,
    }
  },

  computed: {
    calculateDailyInterest() {
      const balance = this.staked - this.unstakeValue;
      if (balance <= 0) {
        return 0;
      } else {
        return this.apy / 365 * balance;
      }
    }
  },

  methods: {
    submit() {
      this.$emit('UNSTAKE', this.unstakeValue);
    },

    unstakeValueChange(event) {
      this.unstakeValue = event.value;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";
</style>