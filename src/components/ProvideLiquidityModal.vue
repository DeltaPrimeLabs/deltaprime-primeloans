<template>
  <div id="modal" v-if="lpToken" class="provide-liquidity-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Provide Liquidity
      </div>

      <CurrencyInput :symbol="firstAsset.symbol" v-on:inputChange="firstInputChange" :defaultValue="firstAmount"></CurrencyInput>
      <CurrencyInput :symbol="secondAsset.symbol" v-on:inputChange="secondInputChange" :defaultValue="secondAmount"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__values">
            <div class="summary__label">
              LP token balance:
            </div>
            <div v-if="true" class="summary__value">
              {{ }}
            </div>
            <div class="summary__divider"></div>
            <div class="summary__label">
              {{ firstAsset.symbol }} balance: {{ firstBalance - firstAmount }}
            </div>
            <div class="summary__divider"></div>
            <div class="summary__label">
              {{ secondAsset.symbol }} balance: {{ secondBalance - secondAmount }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Provide liquidity'" v-on:click="submit()"></Button>
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
  name: 'ProvideLiquidityModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle
  },

  props: {
    lpToken: {},
    firstBalance: Number,
    secondBalance: Number,
  },

  data() {
    return {
      firstAmount: null,
      secondAmount: null,
      validators: {}
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
    });
  },

  computed: {
    firstAsset() {
      return config.ASSETS_CONFIG[this.lpToken.primary];
    },
    secondAsset() {
      return config.ASSETS_CONFIG[this.lpToken.secondary];
    }
  },

  methods: {
    submit() {
      this.$emit('PROVIDE_LIQUIDITY',
          { firstAsset: this.firstAsset, secondAsset: this.secondAsset, firstAmount: this.firstAmount, secondAmount: this.secondAmount });
    },

    firstInputChange(change) {
      this.firstAmount = change;
      this.secondAmount = this.firstAmount * this.lpToken.firstPrice / this.lpToken.secondPrice;
    },

    secondInputChange(change) {
      this.secondAmount = change;
      this.firstAmount = this.secondAmount * this.lpToken.secondPrice / this.lpToken.firstPrice;
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