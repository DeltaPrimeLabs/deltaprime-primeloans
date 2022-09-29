<template>
  <div v-if="asset" id="modal" class="withdraw-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        Withdraw
      </div>

      <CurrencyInput :symbol="asset.symbol"
                     v-on:newValue="withdrawValueChange"
                     :max="Number(asset.balance)"
                     :validators="validators"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after confirmation:
          </div>
          <div class="summary__values">
            <div class="summary__label" v-bind:class="{'summary__label--error': ltvAfterTransaction > MAX_ALLOWED_LTV}">
              LTV:
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
              {{ asset.balance - withdrawValue | smartRound }} {{ asset.symbol }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="toggle-container" v-if="asset.symbol === 'AVAX'">
        <Toggle v-on:change="assetToggleChange"></Toggle>
      </div>

      <div class="button-wrapper">
        <Button :label="'Withdraw'" v-on:click="submit()" :disabled="currencyInputError"></Button>
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
import config from '../config';

export default {
  name: 'WithdrawModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle,
  },

  props: {
    asset: {},
    ltv: {},
    totalCollateral: {},

  },

  data() {
    return {
      withdrawValue: 0,
      ltvAfterTransaction: 0,
      validators: [],
      currencyInputError: false,
      MAX_ALLOWED_LTV: config.MAX_ALLOWED_LTV,
      selectedWithdrawAsset: 'AVAX'
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
      this.updateLTVAfterTransaction();
    });
  },

  computed: {
    getModalHeight() {
      return this.asset.symbol === 'AVAX' ? '561px' : null;
    },
  },

  methods: {
    submit() {
      let withdrawEvent = {};
      if (this.asset.symbol === 'AVAX') {
        withdrawEvent = {
          withdrawAsset: this.selectedWithdrawAsset,
          value: this.withdrawValue,
        };
      } else {
        withdrawEvent = {
          withdrawAsset: this.asset.symbol,
          value: this.withdrawValue,
        };
      }
      console.log(withdrawEvent);
      this.$emit('WITHDRAW', withdrawEvent);
    },


    withdrawValueChange(event) {
      this.withdrawValue = event.value;
      this.currencyInputError = event.error;
      this.updateLTVAfterTransaction();
    },

    calculateLTVAfterTransaction() {
      if (this.withdrawValue) {
        const loan = this.totalCollateral * this.ltv;
        return loan / (this.totalCollateral - (this.withdrawValue * this.asset.price));
      } else {
        return this.ltv;
      }
    },

    assetToggleChange(asset) {
      this.selectedWithdrawAsset = asset;
    },

    updateLTVAfterTransaction() {
      this.ltvAfterTransaction = this.calculateLTVAfterTransaction();
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (this.calculateLTVAfterTransaction() > config.MAX_ALLOWED_LTV) {
              return `LTV should be lower than ${config.MAX_ALLOWED_LTV * 100}%`;
            }
          }
        },
        {
          validate: (value) => {
            if (this.asset.balance - value < 0) {
              return `Withdraw amount exceeds balance`;
            }
          }
        }
      ];
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.withdraw-modal-component {
  .toggle-container {
    margin-top: 40px;
  }
}

</style>