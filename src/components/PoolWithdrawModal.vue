<template>
  <div id="modal" class="pool-withdraw-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        Withdraw
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ apy | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Deposit:</div>
        <div class="top-info__value">{{ deposit | smartRound }}<span class="top-info__currency">{{ assetSymbol }}</span></div>
      </div>

      <CurrencyInput :symbol="assetSymbol" v-on:newValue="withdrawValueChange" ></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            <div class="pool">
              <img class="pool__icon" v-if="assetSymbol" :src="getAssetIcon(assetSymbol)">
              <div class="pool__name">{{ assetSymbol }} Pool</div>
              ,
            </div>
            Values after confirmation:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div class="summary__value__pair">
              <div class="summary__label">
                Deposit:
              </div>
              <div class="summary__value">
                {{ Number(deposit) - Number(withdrawValue) > 0 ? deposit - withdrawValue : 0 | smartRound(8, true) }} <span class="currency">{{ assetSymbol }}</span>
              </div>
            </div>
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                Mean daily interest (365D):
              </div>
              <div class="summary__value">
                ≈ {{ calculateDailyInterest | smartRound(8, true) }} <span class="currency">{{ assetSymbol }}</span>
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="toggle-container" v-if="assetSymbol === 'AVAX'">
        <Toggle v-on:change="assetToggleChange" :options="['AVAX', 'WAVAX']"></Toggle>
      </div>

      <div class="button-wrapper">
        <Button :label="'Withdraw'" v-on:click="submit()" :waiting="transactionOngoing"></Button>
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


export default {
  name: 'PoolWithdrawModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    Toggle
  },

  props: {
    apy: null,
    available: null,
    deposit: null,
    assetSymbol: null,
  },

  data() {
    return {
      withdrawValue: 0,
      selectedWithdrawAsset: 'AVAX',
      transactionOngoing: false,
    }
  },

  mounted() {
    this.selectedWithdrawAsset = 'AVAX'
  },

  computed: {
    calculateDailyInterest() {
      const value = this.deposit - this.withdrawValue;
      if (value > 0) {
        return this.apy / 365 * value;
      } else {
        return 0;
      }
    },

    getModalHeight() {
      return this.assetSymbol === 'AVAX' ? '561px' : null;
    },
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const withdrawEvent = {
        value: this.withdrawValue,
        withdrawNativeToken: this.assetSymbol === 'AVAX' && this.selectedWithdrawAsset === 'AVAX',
      }
      this.$emit('WITHDRAW', withdrawEvent);
    },


    withdrawValueChange(event) {
      this.withdrawValue = event.value;
    },

    assetToggleChange(asset) {
      this.selectedWithdrawAsset = asset;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

</style>
