<template>
  <div v-if="asset" id="modal" class="borrow-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Borrow
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ loanAPY | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Available in pool:</div>
        <div class="top-info__value">{{ poolTVL }}<span class="top-info__currency">{{ asset.symbol }}</span></div>
      </div>

      <CurrencyInput :symbol="asset.symbol"
                     :validators="validators"
                     v-on:inputChange="inputChange"
                     v-on:newValue="currencyInputChange"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__values">
            <div class="summary__label" v-bind:class="{'summary__label--error': ltvAfterTransaction > MAX_ALLOWED_LTV}">
              Health Ratio:
            </div>
            <div class="summary__value">
              <span class="summary__value--error" v-if="ltvAfterTransaction > MAX_ALLOWED_LTV">
                > {{ MAX_ALLOWED_LTV | percent }}
              </span>
              <span v-if="ltvAfterTransaction <= MAX_ALLOWED_LTV">
                {{ ltvAfterTransaction | percent }}
              </span>
            </div>
            <BarGaugeBeta :min="0" :max="5" :value="ltvAfterTransaction" :slim="true"></BarGaugeBeta>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Balance:
            </div>
            <div class="summary__value">
              {{ Number(assetBalance) + Number(value) | smartRound }} {{ asset.symbol }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Borrow'" v-on:click="submit()" :disabled="currencyInputError"></Button>
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
import config from '../config';

export default {
  name: 'BorrowModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {
    asset: {},
    assetBalance: {},
    ltv: {},
    totalCollateral: {},
    loanAPY: {},
    poolTVL: {},
    maxLTV: {}
  },

  data() {
    return {
      value: 0,
      ltvAfterTransaction: 0,
      validators: [],
      currencyInputError: false,
      MAX_ALLOWED_LTV: config.MAX_ALLOWED_LTV,
    };
  },

  mounted() {
    setTimeout(() => {
      this.calculateLTVAfterTransaction();
      this.setupValidators();
    });
  },

  methods: {
    submit() {
      this.$emit('BORROW', this.value);
    },

    inputChange(change) {
      this.value = change;
      this.calculateLTVAfterTransaction();
    },

    currencyInputChange(changeEvent) {
      this.currencyInputError = changeEvent.error;
    },

    calculateLTVAfterTransaction() {
      //TODO: this code is duplicated
      if (this.value) {
        const loan = this.totalCollateral * this.ltv;
        this.ltvAfterTransaction = (loan + (this.value * this.asset.price)) / this.totalCollateral;
      } else {
        this.ltvAfterTransaction = this.ltv;
      }
    },

    setupValidators() {
      // this.validators = [
      //   {
      //     validate: (value) => {
      //       if (this.ltvAfterTransaction > config.MAX_ALLOWED_LTV) {
      //         return `LTV should be lower than ${config.MAX_ALLOWED_LTV * 100}%`;
      //       }
      //     }
      //   }
      // ];
      this.validators = [];
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";


</style>