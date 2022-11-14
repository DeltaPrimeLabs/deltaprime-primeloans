<template>
  <div v-if="asset" id="modal" class="withdraw-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        Withdraw
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value">
          {{ asset.balance | smartRound }}
          <span class="top-info__currency">
            {{asset.symbol}}
          </span>
        </div>
      </div>

      <CurrencyInput v-if="isLP"
                     :symbol="asset.primary"
                     :symbol-secondary="asset.secondary"
                     v-on:newValue="withdrawValueChange"
                     :max="Number(asset.balance)"
                     :validators="validators"></CurrencyInput>
      <CurrencyInput v-else
                     :symbol="asset.symbol"
                     v-on:newValue="withdrawValueChange"
                     :max="Number(asset.balance)"
                     :validators="validators"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after confirmation:
          </div>
          <div class="summary__values">
            <div class="summary__label" v-bind:class="{'summary__label--error': healthAfterTransaction > MIN_ALLOWED_HEALTH}">
              Health Ratio:
            </div>
            <div class="summary__value">
              <span class="summary__value--error" v-if="healthAfterTransaction > MIN_ALLOWED_HEALTH">
                > {{ MIN_ALLOWED_HEALTH | percent }}
              </span>
              <span v-if="healthAfterTransaction <= MIN_ALLOWED_HEALTH">
                {{ healthAfterTransaction | percent }}
              </span>
            </div>
            <BarGaugeBeta :min="0" :max="1" :value="healthAfterTransaction" :slim="true"></BarGaugeBeta>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Balance:
            </div>
            <div class="summary__value">
              {{ asset.balance - withdrawValue | smartRound }} {{ isLP ? asset.primary + '-' + asset.secondary : asset.symbol  }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="toggle-container" v-if="asset.symbol === 'AVAX'">
        <Toggle v-on:change="assetToggleChange" :options="['AVAX', 'WAVAX']"></Toggle>
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
import {calculateHealth} from "../utils/calculate";

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
    health: {},
    isLp: false
  },

  data() {
    return {
      withdrawValue: 0,
      healthAfterTransaction: 0,
      validators: [],
      currencyInputError: false,
      MIN_ALLOWED_HEALTH: config.MIN_ALLOWED_HEALTH,
      selectedWithdrawAsset: 'AVAX'
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
      this.updateHealthAfterTransaction();
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

      this.$emit('WITHDRAW', withdrawEvent);
    },


    withdrawValueChange(event) {
      this.withdrawValue = event.value;
      this.currencyInputError = event.error;
      this.calculateHealthAfterTransaction();
    },

    calculateHealthAfterTransaction() {
      if (this.withdrawValue) {
        this.healthAfterTransaction = calculateHealth(this.loan - this.repayValue,
            this.thresholdWeightedValue - this.repayValue * this.asset.price * this.asset.maxLeverage);
      } else {
        this.healthAfterTransaction = this.health;
      }
    },

    assetToggleChange(asset) {
      this.selectedWithdrawAsset = asset;
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (this.healthAfterTransaction === 0) {
              return `Health should be higher than 0%`;
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

</style>