<template>
  <div id="modal" class="swap-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Swap
      </div>

      <CurrencyComboInput ref="sourceInput"
                          :asset-options="sourceAssetOptions"
                          :value="'BTC'"
                          v-on:valueChange="sourceInputChange">
      </CurrencyComboInput>
      <div class="asset-info">
        Available: <span class="asset-info__value">{{ sourceAssetBalance }}</span>
      </div>

      <div class="reverse-swap-button">
        <img src="src/assets/icons/swap-arrow.svg" class="reverse-swap-icon" v-on:click="reverseSwap">
      </div>

      <CurrencyComboInput ref="targetInput"
                          :asset-options="targetAssetOptions"
                          :value="'ETH'"
                          v-on:valueChange="targetInputChange">
      </CurrencyComboInput>
      <div class="asset-info">
        Price: <span
        class="asset-info__value">1 {{ targetAsset }} = {{ conversionRate | smartRound }} {{ sourceAsset }}</span>
      </div>

      <div class="button-wrapper">
        <Button :label="'Swap'" v-on:click="submit()"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import CurrencyInput from './CurrencyInput';
import Button from './Button';
import CurrencyComboInput from './CurrencyComboInput';
import config from '../config';

export default {
  name: 'SwapModal',
  components: {
    CurrencyComboInput,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
  },

  props: {},

  data() {
    return {
      sourceAssetOptions: [],
      targetAssetOptions: [],
      sourceAsset: null,
      targetAsset: null,
      sourceAssetBalance: null,
      conversionRate: null,
      sourceAssetAmount: null,
      targetAssetAmount: null,
    };
  },

  mounted() {
    this.setupSourceAssetOptions();
    this.setupTargetAssetOptions();
    setTimeout(() => {
      this.setupSourceAsset();
      this.setupTargetAsset();
      this.setupConversionRate();
    });
  },

  computed: {
  },

  methods: {
    submit() {
      this.$emit('swap',{
        sourceAsset: this.sourceAsset,
        targetAsset: this.targetAsset,
        sourceAmount: this.sourceAssetAmount,
        targetAmount: this.targetAssetAmount,
      });
    },

    setupSourceAssetOptions() {
      Object.keys(config.ASSETS_CONFIG).forEach(assetSymbol => {
        const asset = config.ASSETS_CONFIG[assetSymbol];
        const assetOption = {
          symbol: assetSymbol,
          name: asset.name,
          logo: `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
        };
        this.sourceAssetOptions.push(assetOption);
      });
    },

    setupTargetAssetOptions() {
      this.targetAssetOptions = JSON.parse(JSON.stringify(this.sourceAssetOptions));
      this.targetAssetOptions = this.targetAssetOptions.filter(option => option.symbol !== this.sourceAsset);
    },

    setupSourceAsset() {
      this.$refs.sourceInput.setSelectedAsset(this.sourceAsset, true);
    },

    setupTargetAsset() {
      if (this.targetAsset) {
        this.$refs.targetInput.setSelectedAsset(this.targetAsset, true);
      }
    },

    sourceInputChange(change) {
      console.log('sourceInputChange');
      if (change.asset === this.targetAsset) {
        this.reverseSwap();
      } else {
        this.sourceAsset = change.asset;
        const targetAssetAmount = change.value / this.conversionRate;
        console.log(targetAssetAmount);
        if (!Number.isNaN(targetAssetAmount)) {
          const value = Math.ceil(targetAssetAmount * 1000000) / 1000000;
          this.sourceAssetAmount = change.value;
          this.targetAssetAmount = value;
          this.$refs.targetInput.setCurrencyInputValue(value);

          this.calculateSourceAssetBalance();
          this.setupConversionRate();
        }
      }
    },

    targetInputChange(change) {
      console.log('targetInputChange');
      if (change.asset === this.sourceAsset) {
        this.reverseSwap();
      } else {
        this.targetAsset = change.symbol;
        const sourceAssetAmount = change.value * this.conversionRate;
        console.log(sourceAssetAmount);
        if (!Number.isNaN(sourceAssetAmount)) {
          const value = Math.ceil(sourceAssetAmount * 1000000) / 1000000;
          this.targetAssetAmount = change.value;
          this.sourceAssetAmount = value;
          this.$refs.sourceInput.setCurrencyInputValue(value);

          this.calculateSourceAssetBalance();
          this.setupConversionRate();
        }
      }
    },

    setupConversionRate() {
      const sourceAsset = config.ASSETS_CONFIG[this.sourceAsset];
      const targetAsset = config.ASSETS_CONFIG[this.targetAsset];
      console.log(sourceAsset)
      console.log(targetAsset)
      this.conversionRate = targetAsset.price / sourceAsset.price;
    },

    calculateSourceAssetBalance() {
      this.sourceAssetBalance = config.ASSETS_CONFIG[this.sourceAsset].balance;
    },

    reverseSwap() {
      const tempSource = this.sourceAsset;
      this.sourceAsset = this.targetAsset;
      this.targetAsset = tempSource;

      this.setupSourceAsset();
      this.setupTargetAsset();

      this.calculateSourceAssetBalance();
      this.setupConversionRate();
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.swap-modal-component {

  .modal__title {
    margin-bottom: 53px;
  }

  .asset-info {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    font-size: $font-size-xsm;
    color: $steel-gray;
    padding-right: 8px;

    .asset-info__value {
      font-weight: 600;
      margin-left: 5px;
    }
  }

  .reverse-swap-button {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    .reverse-swap-icon {
      width: 52px;
      height: 52px;
      margin: -6px 0 14px 0;
    }
  }
}

</style>