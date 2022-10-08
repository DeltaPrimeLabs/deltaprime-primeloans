<template>
  <div id="modal" v-if="lpToken" class="provide-liquidity-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Remove Liquidity
      </div>

      <CurrencyInput :symbol="lpToken.primary" :symbol-secondary="lpToken.secondary" v-on:inputChange="inputChange"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__values">
            <div class="summary__label">
              {{ `${lpToken.primary} - ${lpToken.secondary}` }} balance:
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Remove liquidity'" v-on:click="submit()"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import CurrencyInput from './CurrencyInput';
import Button from './Button';
import Toggle from './Toggle';
import BarGaugeBeta from './BarGaugeBeta';
import config from "../config";


export default {
  name: 'RemoveLiquidityModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle
  },

  props: {
    lpToken: {}
  },

  data() {
    return {
      amount: null,
      validators: {}
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
    });
  },

  computed: {
  },

  methods: {
    submit() {
      this.$emit('REMOVE_LIQUIDITY',
          { asset: this.lpToken.symbol, secondAmount: this.amount });
    },

    inputChange(change) {
      this.amount = change;
    },

    setupValidators() {
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.provide-liquidity-modal-component {

}


</style>