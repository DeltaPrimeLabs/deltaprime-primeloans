<template>
  <div id="modal" class="stake-modal-component modal-component">
    <Modal v-if="asset">
      <div class="modal__title">
        Stake
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ apy | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Available:</div>
        <div class="top-info__value">{{ available }}
          <span class="top-info__currency"> {{ asset.name }}</span>
        </div>
      </div>

      <CurrencyInput v-if="isLP"
                     :symbol="asset.primary"
                     :symbol-secondary="asset.secondary"
                     v-on:newValue="stakeValueChange"
                     :validators="validators"
                     :max="available">
      </CurrencyInput>
      <CurrencyInput ref="currencyInput"
                     v-else
                     :symbol="asset.symbol"
                     v-on:newValue="stakeValueChange"
                     :validators="validators"
                     :max="available">
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
          <div class="summary__values" v-if="asset">
            <div class="summary__value__pair">
              <div class="summary__label">
                Balance:
              </div>
              <div class="summary__value">
                {{ (Number(available) - Number(stakeValue)) > 0 ? Number(available) - Number(stakeValue) : 0 | smartRound }}
                <span class="currency">
                  {{asset.name}}
                </span>
              </div>
            </div>
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">

              <div class="summary__label">
                Staked:
              </div>
              <div class="summary__value">
                {{ Number(staked) + Number(stakeValue) | smartRound }}
                <span class="currency">{{ asset.name }}</span>
              </div>
            </div>
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">

              <div class="summary__label">
                Daily interest ≈
              </div>
              <div class="summary__value">
                {{ calculateDailyInterest | smartRound }} <span class="currency">{{ asset.name }}</span>
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Stake'"
                v-on:click="submit()"
                :disabled="currencyInputError"
                :waiting="transactionOngoing">
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
import config from '../config';

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
    staked: {},
    asset: {},
    isLp: false,
    protocol: null
  },

  data() {
    return {
      stakeValue: 0,
      validators: [],
      transactionOngoing: false,
      currencyInputError: false,
    };
  },

  mounted() {
    this.setupValidators();
  },
  computed: {
    calculateDailyInterest() {
      return this.apy / 365 * (Number(this.staked) + Number(this.stakeValue));
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      this.$emit('STAKE', this.stakeValue);
    },


    stakeValueChange(event) {
      this.stakeValue = event.value;
      this.currencyInputError = event.error;
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.available) {
              return `Exceeds available`;
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