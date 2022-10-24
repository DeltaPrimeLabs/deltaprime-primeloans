<template>
  <div v-if="asset" id="modal" class="add-from-wallet-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        Add from wallet
      </div>

      <CurrencyInput v-if="isLP" :symbol="asset.primary" :symbol-secondary="asset.secondary" v-on:inputChange="inputChange"></CurrencyInput>
      <CurrencyInput v-else :symbol="asset.symbol" v-on:inputChange="inputChange"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__values">
            <div class="summary__label">
              Health Ratio:
            </div>
            <div class="summary__value">
              {{ ltvAfterTransaction | percent }}
            </div>
            <BarGaugeBeta :min="0" :max="5" :value="ltvAfterTransaction" :slim="true"></BarGaugeBeta>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Balance:
            </div>
            <div v-if="asset.balance" class="summary__value">
              {{ Number(asset.balance) + value | smartRound }} {{ isLP ? asset.primary + '-' + asset.secondary : asset.symbol }}
            </div>
            <div v-if="!asset.balance" class="summary__value">
              {{ value | smartRound }} {{ isLP ? asset.primary + '-' + asset.secondary : asset.symbol }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="toggle-container" v-if="asset.symbol === 'AVAX'">
        <Toggle v-on:change="assetToggleChange"></Toggle>
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
import Toggle from './Toggle';
import BarGaugeBeta from './BarGaugeBeta';


export default {
  name: 'AddFromWalletModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle
  },

  props: {
    asset: {},
    ltv: {},
    totalCollateral: {},
    isLP: false
  },

  data() {
    return {
      value: 0,
      ltvAfterTransaction: 0,
      validators: {},
      selectedDepositAsset: 'AVAX'
    };
  },

  mounted() {
    setTimeout(() => {
      this.calculateLTVAfterTransaction();
      this.setupValidators();
    });
  },

  computed: {
    getModalHeight() {
      return this.asset.symbol === 'AVAX' ? '561px' : null;
    },
  },

  methods: {
    submit() {
      if (this.asset.symbol === 'AVAX') {
        this.$emit('ADD_FROM_WALLET', {value: this.value, asset: this.selectedDepositAsset});
      } else {
        this.$emit('ADD_FROM_WALLET', {value: this.value, asset: this.asset});
      }
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
        this.ltvAfterTransaction = this.ltv !== null ? this.ltv : 0;
      }
    },

    setupValidators() {
    },

    assetToggleChange(asset) {
      this.selectedDepositAsset = asset;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";


</style>