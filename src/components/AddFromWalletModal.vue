<template>
  <div v-if="asset" id="modal" class="add-from-wallet-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        Add from wallet
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value">
          {{ getAvailableAssetAmount | smartRound }}
          <span v-if="asset.symbol === 'AVAX'" class="top-info__currency">
            {{selectedDepositAsset}}
          </span>
          <span v-if="asset.symbol !== 'AVAX'" class="top-info__currency">
            {{asset.symbol}}
          </span>
        </div>
      </div>

      <CurrencyInput v-if="isLP" :symbol="asset.primary" :symbol-secondary="asset.secondary" v-on:inputChange="inputChange"></CurrencyInput>
      <CurrencyInput ref="currencyInput" v-else :symbol="asset.symbol" v-on:inputChange="inputChange" :validators="validators"></CurrencyInput>

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
              {{ healthAfterTransaction | percent }}
            </div>
            <BarGaugeBeta :min="0" :max="1" :value="healthAfterTransaction" :slim="true"></BarGaugeBeta>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Balance:
            </div>
            <div class="summary__value">
              {{ (Number(assetBalance) + Number(value)) | smartRound }} {{ isLP ? asset.primary + '-' + asset.secondary : asset.symbol }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="toggle-container" v-if="asset.symbol === 'AVAX'">
        <Toggle v-on:change="assetToggleChange" :options="['AVAX', 'WAVAX']"></Toggle>
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
import {mapState} from 'vuex';
import {calculateHealth} from "../utils/calculate";


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
    thresholdWeightedValue: Number,
    loan: Number,
    assetBalance: Number,
    isLP: false,
    walletAssetBalance: {},
    walletNativeTokenBalance: {}
  },

  data() {
    return {
      value: 0,
      healthAfterTransaction: 0,
      validators: [],
      selectedDepositAsset: 'AVAX'
    };
  },

  mounted() {
    setTimeout(() => {
      this.calculateHealthAfterTransaction();
      this.setupValidators();
    });
  },

  computed: {
    ...mapState('network', ['account', 'accountBalance']),
    getModalHeight() {
      return this.asset.symbol === 'AVAX' ? '561px' : null;
    },

    getAvailableAssetAmount() {
      if (this.asset.symbol === 'AVAX') {
        return this.selectedDepositAsset === 'AVAX' ? this.walletNativeTokenBalance : this.walletAssetBalance;
      } else {
        return this.walletAssetBalance;
      }
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
      this.calculateHealthAfterTransaction();
    },

    calculateHealthAfterTransaction() {
      if (this.value) {
        this.healthAfterTransaction = calculateHealth(this.loan, this.thresholdWeightedValue + this.value * this.asset.price * this.asset.maxLeverage);
      } else {
        this.healthAfterTransaction = this.health !== null ? this.health : 0;
      }
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.getAvailableAssetAmount) {
              return 'Exceeds account balance';
            }
          }
        }
      ]
    },

    assetToggleChange(asset) {
      this.selectedDepositAsset = asset;
      this.$refs.currencyInput.forceValidationCheck();
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";


</style>