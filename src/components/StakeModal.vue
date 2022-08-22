<template>
  <div id="modal" class="stake-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Stake
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ apy | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Available:</div>
        <div class="top-info__value">{{ available | smartRound }}<span class="top-info__currency">AVAX</span></div>
      </div>

      <CurrencyInput :symbol="'AVAX'" v-on:newValue="stakeValueChange"></CurrencyInput>

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
              {{ staked + stakeValue | smartRound }} <span class="currency">AVAX</span>
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
        <Button :label="'Stake'" v-on:click="submit()"></Button>
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
      stakeValue: 0,
    }
  },

  computed: {
    calculateDailyInterest() {
      return this.apy / 365 * (this.staked + this.stakeValue);
    }
  },

  methods: {
    submit() {
      this.$emit('STAKE', this.stakeValue);
    },


    stakeValueChange(event) {
      this.stakeValue = event.value;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";
</style>