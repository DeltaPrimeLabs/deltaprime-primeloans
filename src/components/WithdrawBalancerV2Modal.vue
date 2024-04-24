<template>
  <div id="modal" class="unstake-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Export LP position
      </div>

      <div class="modal-top-desc">
        <div class="rewards-info">
          {{description}}
        </div>
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{balance | smartRound(10, true)}}</div>
        <span class="top-info__currency">
          BPT
        </span>
      </div>
      <div v-if="canRepayAllDebts === false">
        Not all 'borrowed' is covered by its 'balance'. Update missing balance(s) to withdraw. <a target="_blank" style="color: var(--currency-input__error-color)" href="https://docs.deltaprime.io/protocol/security/withdrawal-guard">Read more</a>.
      </div>

      <div class="button-wrapper">
        <Button :label="'Export'"
                v-on:click="submit()"
                :disabled="!canRepayAllDebts"
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
    title: null,
    description: null,
    assetBalances: null,
    debtsPerAsset: null,
    balance: 0,
    transactionOngoing: false
  },

  data() {
    return {
      canRepayAllDebts: null
    }
  },

  computed: {

  },

  methods: {
    submit() {
      this.transactionOngoing = true;

      const unstakeEvent = {
      };

      this.$emit('WITHDRAW', unstakeEvent);
    },

    initiate() {
      this.setupValidators();
    },

    setupValidators() {
      this.canRepayAllDebts = Object.values(this.debtsPerAsset).every(
          debt => {
            let balance = parseFloat(this.assetBalances[debt.asset]);
            return parseFloat(debt.debt) <= balance;
          }
      );
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";
</style>