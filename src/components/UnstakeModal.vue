<template>
  <div v-if="asset" id="modal" class="unstake-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        {{ title ? title : 'Unstake' }}
      </div>

      <template v-if="targetAssetsOptions">
        <div class="modal-top-info modal-top-info--toggle-info">
          <div class="top-info__label">Unstake to:</div>
        </div>

        <div>
          <Toggle v-on:change="assetToggleChange" :options="targetAssetsOptions"></Toggle>
        </div>
      </template>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ apy | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Staked:</div>
        <div class="top-info__value">{{ staked | smartRound(12, true) }}</div>
      </div>

      <CurrencyInput v-if="isLP"
                     :symbol="asset.primary"
                     :symbol-secondary="asset.secondary"
                     v-on:newValue="unstakeValueChange"
                     :validators="validators"
                     :max="staked"
                     :info="() => sourceAssetValue">
      </CurrencyInput>
      <CurrencyInput ref="currencyInput"
                     v-else
                     :symbol="asset.symbol"
                     :logo="assetLogo"
                     :force-asset-name="forceAssetName"
                     v-on:newValue="unstakeValueChange"
                     :validators="validators"
                     :max="staked"
                     :info="() => sourceAssetValue">
      </CurrencyInput>


      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after confirmation:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div class="summary__label">
              Staked:
            </div>
            <div class="summary__value">
              {{ staked - unstakeValue > 0 ? staked - unstakeValue : 0 | smartRound(8, true) }}
            </div>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Mean daily interest (365D):
            </div>
            <div class="summary__value">
              ≈ $ {{ calculateDailyInterest | smartRound(8, true) }}
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
import config from '../config';
import Toggle from "./Toggle.vue";

export default {
  name: 'StakeModal',
  components: {
    Toggle,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal
  },

  props: {
    apy: {},
    available: {},
    staked: {},
    receiptTokenBalance: {},
    asset: {},
    isLp: false,
    protocol: null,
    assetLogo: null,
    forceAssetName: null,
    targetAssetsOptions: null,
    title: null,
    justInput: null,
  },

  data() {
    return {
      unstakeValue: 0,
      validators: [],
      transactionOngoing: false,
      currencyInputError: true,
      valueAsset: "USDC",
      selectedTargetAsset: null,
    }
  },

  mounted() {
    this.setupValidators();
  },

  computed: {
    calculateDailyInterest() {
      const staked = this.staked - this.unstakeValue;
      if (staked <= 0) {
        return 0;
      } else {
        return this.apy / 365 * staked * this.asset.price;
      }
    },

    sourceAssetValue() {
      const nativeSymbol = config.nativeToken;
      const sourceAssetUsdPrice = Number(this.unstakeValue) * this.asset.price;
      const nativeUsdPrice = config.ASSETS_CONFIG[nativeSymbol].price;

      if (this.valueAsset === "USDC") return `~ $${sourceAssetUsdPrice.toFixed(2)}`;
      // otherwise return amount in AVAX
      return `~ ${(sourceAssetUsdPrice / nativeUsdPrice).toFixed(2)} ${nativeSymbol}`;
    },
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      let unstakedPart = this.unstakeValue / this.staked;
      const unstakedReceiptToken = this.justInput ? this.unstakeValue : this.maxButtonUsed ? this.receiptTokenBalance * config.MAX_BUTTON_MULTIPLIER : unstakedPart * this.receiptTokenBalance;

      const unstakeEvent = {
        receiptTokenUnstaked: unstakedReceiptToken,
        underlyingTokenUnstaked: this.unstakeValue,
        isMax: this.maxButtonUsed,
        selectedTargetAsset: this.selectedTargetAsset,
      };

      this.$emit('UNSTAKE', unstakeEvent);
    },

    unstakeValueChange(event) {
      this.unstakeValue = event.value;
      this.currencyInputError = event.error;
      this.maxButtonUsed = event.maxButtonUsed;
    },

    async assetToggleChange(asset) {
      this.selectedTargetAsset = asset;
    },

    setupValidators() {
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.modal-top-info--toggle-info {
  margin-top: 8px;
}

.modal__title {
  margin-bottom: 30px;
}
</style>
