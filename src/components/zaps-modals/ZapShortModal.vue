<template>
  <div id="modal" class="zap-short-modal-component modal-component">
    <Modal :height="'1200px'">
      <div class="modal__title">
        Short
      </div>

      <div class="modal__content">
        <div class="top-up-input">
          <CurrencyComboInput ref="stableCoinInput"
                              :asset-options="shortAssetOptions"
                              :default-asset="'BTC'"
                              :typingTimeout="100"
                              :validators="validators"
                              v-on:valueChange="shortAssetInputChange"
          >
          </CurrencyComboInput>
        </div>

        <div class="assets-container">
          <AssetFilter ref="assetFilter"
                       :asset-filter-groups="stableCoinOptions"
                       :show-clear-button="false"
                       :single-select-mode="true"
                       v-on:filterChange="stableCoinChange">
          </AssetFilter>
        </div>
      </div>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div>
              <div class="summary__label" v-bind:class="{'summary__label--error': healthAfterTransaction === 0}">
                Health:
              </div>
              <div class="summary__value">
              <span class="summary__value--error"
                    v-if="healthAfterTransaction < MIN_ALLOWED_HEALTH">
                {{healthAfterTransaction | percent}}
              </span>
                <span v-else>
                {{healthAfterTransaction | percent}}
              </span>
              </div>
              <BarGaugeBeta :min="0" :max="1" :value="healthAfterTransaction" :slim="true"></BarGaugeBeta>
            </div>
            <div class="summary__divider"></div>
            <div>
              <div class="summary__label">
                {{selectedShortAsset}} short for:
              </div>
              <div class="summary__value">
                {{shortPositionValueInStableCoin | smartRound(5, true)}} {{selectedStableCoin}}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>


      <div class="button-wrapper">
        <Button :label="'Leverage'" v-on:click="submit()"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import TransactionResultSummaryBeta from '../TransactionResultSummaryBeta.vue';
import Toggle from '../Toggle.vue';
import CurrencyInput from '../CurrencyInput.vue';
import LoadedValue from '../LoadedValue.vue';
import Button from '../Button.vue';
import BarGaugeBeta from '../BarGaugeBeta.vue';
import Modal from '../Modal.vue';
import CurrencyComboInput from '../CurrencyComboInput.vue';
import config from '../../config';
import RangeSlider from '../RangeSlider.vue';
import Slider from '../Slider.vue';
import AssetFilter from '../AssetFilter.vue';
import Checkbox from '../Checkbox.vue';
import {calculateHealth} from '../../utils/calculate';

export default {
  name: 'ZapShortModal',
  components: {
    Checkbox,
    AssetFilter,
    RangeSlider,
    Slider,
    CurrencyComboInput,
    Modal, BarGaugeBeta, Button, LoadedValue, CurrencyInput, Toggle, TransactionResultSummaryBeta
  },

  props: {
    stableCoinsWalletBalances: {},
    accountAssetBalances: {},
  },

  data() {
    return {
      assets: {},
      assetBalances: {},
      lpAssets: {},
      lpBalances: {},
      concentratedLpAssets: {},
      concentratedLpBalances: {},
      farms: {},
      debtsPerAsset: {},
      thresholdWeightedValue: Number,

      toggleOptions: ['Top up', 'Existing funds'],
      shortAssetOptions: null,
      stableCoinOptions: [],
      healthAfterTransaction: 0,
      MIN_ALLOWED_HEALTH: config.MIN_ALLOWED_HEALTH,
      selectedStableCoin: 'USDC',
      selectedShortAsset: 'BTC',
      includeBalanceFromWallet: false,
      validators: [],
      stableCoinAmount: 0,
      shortAssetAmount: 0,
      extraDepositRequired: 0,
      shortPositionValueInStableCoin: 0,
    };
  },

  mounted() {
    this.setupShortAssetOptions();
    this.setupStableCoinOptions();
    setTimeout(() => {
      this.setupValidators();
      this.calculateHealthAfterTransaction();
      console.log(this.assets);
    });
  },


  computed: {},

  methods: {
    setupShortAssetOptions() {
      this.shortAssetOptions = [];
      const shortAssets = Object.values(config.ASSETS_CONFIG).filter(asset => !asset.isStableCoin);
      shortAssets.forEach(asset => {
        const assetOption = {
          symbol: asset.symbol,
          name: asset.name,
          logo: `src/assets/logo/${asset.symbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
        };
        this.shortAssetOptions.push(assetOption);
      });
    },

    setupStableCoinOptions() {
      this.stableCoinOptions = [
        {
          options: Object.values(config.ASSETS_CONFIG).filter(asset => asset.isStableCoin).map(asset => asset.symbol),
          key: 'asset'
        }
      ];
      setTimeout(() => {
        this.$refs.assetFilter.assetFilterGroups = this.stableCoinOptions;
        this.$refs.assetFilter.setupFilterValue();
      });
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (this.healthAfterTransaction < this.MIN_ALLOWED_HEALTH) {
              return `Health should be higher than 0%`;
            }
          },
        },
      ];
    },

    setupShortPositionDetails() {
      const shortAssetPrice = this.assets[this.selectedShortAsset].price;
      const stableCoinPrice = this.assets[this.selectedStableCoin].price;
      this.shortPositionValueInStableCoin = this.shortAssetAmount * shortAssetPrice / stableCoinPrice;
    },

    calculateHealthAfterTransaction() {
      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);
        if (symbol === this.selectedShortAsset) {
          borrowed += Number(this.shortAssetAmount);
          balance += Number(this.shortAssetAmount);
        }

        tokens.push({price: data.price, balance: balance, borrowed: borrowed, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.lpAssets)) {
        tokens.push({
          price: data.price,
          balance: parseFloat(this.lpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage
        });
      }

      for (const [symbol, data] of Object.entries(this.concentratedLpAssets)) {
        tokens.push({
          price: data.price,
          balance: parseFloat(this.concentratedLpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage
        });
      }

      for (const [, farms] of Object.entries(this.farms)) {
        farms.forEach(farm => {
          tokens.push({
            price: farm.price,
            balance: parseFloat(farm.totalBalance),
            borrowed: 0,
            debtCoverage: farm.debtCoverage
          });
        });
      }

      this.healthAfterTransaction = calculateHealth(tokens);
    },

    shortAssetInputChange(changeEvent) {
      this.selectedShortAsset = changeEvent.asset;
      this.shortAssetAmount = changeEvent.value;
      this.$refs.stableCoinInput.forceValidationCheck();
      this.calculateHealthAfterTransaction();
      this.setupShortPositionDetails()
    },

    addFromWalletCheckboxChange(changeEvent) {
      this.includeBalanceFromWallet = changeEvent;
      console.log('this.includeBalanceFromWallet', this.includeBalanceFromWallet);
      this.$refs.stableCoinInput.forceValidationCheck();
    },

    stableCoinChange(changeEvent) {
      this.selectedStableCoin = changeEvent.asset[0];
      this.setupShortPositionDetails()
    },

    submit() {
      this.$emit('ZAP_SHORT_EVENT',
        {
          stableCoin: this.selectedStableCoin,
          shortAsset: this.selectedShortAsset,
          shortAssetAmount: this.shortAssetAmount,
        }
      );
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.modal__content {
  //height: 480px;
}

.checkbox-container {
  display: flex;
  flex-direction: row;
  justify-content: center;
  margin-bottom: 20px;
}

.top-up-input {
  margin-bottom: 20px;
}

.assets-container {
  margin-bottom: 20px;

  .asset-filter-component {
    justify-content: center;
  }
}

.leverage {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: $font-size-xl;
  margin-bottom: 20px;
}

.slider-container {
  margin-bottom: 20px;

}

</style>