<template>
  <div v-if="asset" id="modal" class="unstake-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Unstake
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ apy | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Farm balance:</div>
        <div class="top-info__value">{{ balance | smartRound(12, true) }}</div>
      </div>

      <CurrencyInput v-if="isLP"
                     :symbol="asset.primary"
                     :symbol-secondary="asset.secondary"
                     v-on:newValue="unstakeValueChange"
                     :validators="validators">
      </CurrencyInput>
      <CurrencyInput ref="currencyInput"
                     v-else
                     :symbol="asset.symbol"
                     v-on:newValue="unstakeValueChange"
                     :validators="validators"">
      </CurrencyInput>


      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            <div v-if="protocol" class="protocol">
              <img class="protocol__icon" :src="`src/assets/logo/${protocol.logo}`">
              <div class="protocol__name">{{ protocol.name }}</div>
              ,
            </div>
            Values after confirmation:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div class="summary__label">
              Farm balance:
            </div>
            <div class="summary__value">
              {{ balance - unstakeValue > 0 ? balance - unstakeValue : 0 | smartRound(9, true) }}
            </div>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Daily interest ≈
            </div>
            <div class="summary__value">
              {{ calculateDailyInterest | smartRound }} <span class="currency">{{ asset.name }}</span>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Unstake'"
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

export default {
  name: 'StakeModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal
  },

  props: {
    apy: {},
    available: {},
    balance: {},
    asset: {},
    isLp: false,
    protocol: null
  },

  data() {
    return {
      unstakeValue: 0,
      validators: [],
      transactionOngoing: false,
      currencyInputError: true,
    }
  },

  mounted() {
    this.setupValidators();
  },

  computed: {
    calculateDailyInterest() {
      const balance = this.balance - this.unstakeValue;
      if (balance <= 0) {
        return 0;
      } else {
        return this.apy / 365 * balance;
      }
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      this.$emit('UNSTAKE', parseFloat(this.unstakeValue).toFixed(this.asset.decimals));
    },

    unstakeValueChange(event) {
      this.unstakeValue = event.value;
      this.currencyInputError = event.error;
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.balance) {
              return `Exceeds balance`;
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