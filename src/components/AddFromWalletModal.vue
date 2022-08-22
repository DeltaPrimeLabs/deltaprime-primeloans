<template>
  <div v-if="asset" id="modal" class="borrow-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Add from wallet
      </div>

      <CurrencyInput :symbol="asset.symbol" v-on:inputChange="inputChange"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__values">
            <div class="summary__label">
              LTV:
            </div>
            <div class="summary__value">
              {{ ltvAfterTransaction | percent }}
            </div>
            <BarGaugeBeta :min="0" :max="5" :value="ltvAfterTransaction" :slim="true"></BarGaugeBeta>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Balance:
            </div>
            <div class="summary__value">
              {{ Number(asset.balance) + value | smartRound }} {{ asset.symbol }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Add funds'" v-on:click="submit()"></Button>
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
import {mapState} from 'vuex';


export default {
  name: 'AddFromWalletModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {
    asset: {},
    ltv: {},
    totalCollateral: {}
  },

  data() {
    return {
      value: 0,
      ltvAfterTransaction: 0,
      validators: {},
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
      this.$emit('ADD_FROM_WALLET', this.value);
    },

    inputChange(change) {
      this.value = change;
      this.calculateLTVAfterTransaction();
    },

    calculateLTVAfterTransaction() {
      if (this.value) {
        const loan = this.totalCollateral * this.ltv;
        this.ltvAfterTransaction = loan / (this.totalCollateral + (this.value * this.asset.price));
      } else {
        this.ltvAfterTransaction = this.ltv;
      }
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