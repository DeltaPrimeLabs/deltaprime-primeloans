<template>
  <div id="modal" class="unstake-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Unstake
      </div>

      <div class="modal-top-desc">
        <div class="rewards-info">
          Your Balancer position will be unstaked and exported to your wallet.
        </div>
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{balance | smartRound(10, true)}}</div>
        <span class="top-info__currency">
          BPT
        </span>
      </div>

      <div class="button-wrapper">
        <Button :label="'Unstake'"
                v-on:click="submit()"
                :waiting="transactionOngoing">
        </Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import CurrencyInput from './CurrencyInput';
import Button from './Button';
import config from '../config';

export default {
  name: 'UnstakeAndWithdrawBalancerV2Modal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal
  },

  props: {
    balance: 0,
    transactionOngoing: false
  },

  data() {
    return {
    }
  },

  mounted() {
    this.setupValidators();
  },

  computed: {

  },

  methods: {
    submit() {
      this.transactionOngoing = true;

      const unstakeEvent = {
      };

      this.$emit('UNSTAKE_AND_WITHDRAW', unstakeEvent);
    },

    setupValidators() {
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";
</style>