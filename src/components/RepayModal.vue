<template>
  <div v-if="asset" id="modal" class="repay-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Repay
      </div>

      <CurrencyInput :symbol="asset.symbol"
                     v-on:newValue="repayValueChange"
                     :max="assetDebt"
                     :validators="validators">
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after confirmation:
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
              Loan:
            </div>
            <div class="summary__value">
              {{ (assetDebt - repayValue) > 0 ? assetDebt - repayValue : 0 | smartRound }} {{ asset.symbol }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Repay'"
                v-on:click="submit()"
                :waiting="transactionOngoing"
                :disabled="currencyInputError">
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
import BarGaugeBeta from './BarGaugeBeta';
import {calculateHealth} from "../utils/calculate";

export default {
  name: 'WithdrawModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {
    asset: {},
    health: {},
    debt: 0,
    initialLoan: {},
    thresholdWeightedValue: {},
    assetDebt: {},
  },

  data() {
    return {
      repayValue: 0,
      healthAfterTransaction: 0,
      transactionOngoing: false,
      validators: [],
      currencyInputError: false,
    }
  },

  mounted() {
    setTimeout(() => {
      this.loan = this.initialLoan;
      this.calculateHealthAfterTransaction();
      this.setupValidators();
    })
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      this.$emit('REPAY', this.repayValue);
    },


    repayValueChange(event) {
      this.repayValue = Number(event.value);
      this.currencyInputError = event.error;
      this.calculateHealthAfterTransaction();
    },

    calculateHealthAfterTransaction() {
      this.healthAfterTransaction = calculateHealth(this.debt - Number(this.repayValue) * this.asset.price,
        this.thresholdWeightedValue - Number(this.repayValue) * this.asset.price * this.asset.maxLeverage);
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.debt) {
              return `Repay value exceeds debt`;
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