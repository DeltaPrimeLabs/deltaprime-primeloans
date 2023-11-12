<template>
  <div id="modal" class="zap-short-modal-component modal-component">
    <Modal :height="'1200px'">
      <div class="modal__title">
        Short
      </div>

      <div class="modal__content">
        <span class="modal-top-desc">Borrows assets and swaps into the chosen stablecoin.</span>

        <div class="top-up-input">
          <CurrencyComboInput ref="shortAssetInput"
                              :asset-options="shortAssetOptions"
                              :typingTimeout="100"
                              :validators="validators"
                              v-on:valueChange="shortAssetInputChange"
          >
          </CurrencyComboInput>
        </div>
        <div class="assets-container">
          <div class="assets-label">Choose stablecoin to swap to:</div>
          <AssetFilter ref="assetFilter"
                       :asset-filter-groups="stableCoinsOptions"
                       :first-one-as-default="true"
                       :show-clear-button="false"
                       :single-select-mode="true"
                       v-on:filterChange="stableCoinSelectChange">
          </AssetFilter>
        </div>
      </div>

      <div class="slippage-bar">
        <div class="slippage-info">
          <span class="slippage-label">Max. acceptable slippage:</span>
          <SimpleInput :percent="true" :default-value="userSlippage" v-on:newValue="userSlippageChange"></SimpleInput>
          <span class="percent">%</span>
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
                {{selectedStableCoin}} amount:
              </div>
              <div class="summary__value">
                {{ stableCoinAmount | smartRound(5, true)}} {{selectedStableCoin}}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>


      <div class="button-wrapper">
        <Button :disabled="!(stableCoinAmount && selectedShortAsset)" :waiting="transactionOngoing" :label="'Short'" v-on:click="submit()"></Button>
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
import AssetFilter from '../AssetFilter.vue';
import Checkbox from '../Checkbox.vue';
import {calculateHealth} from '../../utils/calculate';
import SimpleInput from "../SimpleInput.vue";
import InfoIcon from "../InfoIcon.vue";

export default {
  name: 'ZapShortModal',
  components: {
    InfoIcon, SimpleInput,
    Checkbox,
    AssetFilter,
    CurrencyComboInput,
    Modal, BarGaugeBeta, Button, LoadedValue, CurrencyInput, Toggle, TransactionResultSummaryBeta
  },

  props: {
  },

  data() {
    return {
      assets: {},
      assetBalances: {},
      lpAssets: {},
      lpBalances: {},
      concentratedLpAssets: {},
      concentratedLpBalances: {},
      levelLpAssets: {},
      levelLpBalances: {},
      traderJoeV2LpAssets: {},
      farms: {},
      debtsPerAsset: {},
      thresholdWeightedValue: Number,
      toggleOptions: ['Top up', 'Existing funds'],
      stableCoinsOptions: null,
      shortAssetOptions: [],
      healthAfterTransaction: 0,
      MIN_ALLOWED_HEALTH: config.MIN_ALLOWED_HEALTH,
      selectedStableCoin: 'USDC',
      selectedShortAsset: null,
      availableAssetAmount: 0,
      includeBalanceFromWallet: false,
      validators: [],
      userSlippage: 2,
      stableCoinAmount: 0,
      shortAssetAmount: 0,
      extraDepositRequired: 0,
      shortPositionValueInStableCoin: 0,
      transactionOngoing: false
    };
  },

  mounted() {
    this.setupShortAssetOptions();
    this.setupStableCoinsOptions();
    setTimeout(() => {
      this.setupValidators();
      this.calculateHealthAfterTransaction();
    });
  },


  computed: {},

  methods: {
    setupStableCoinsOptions() {
      this.stableCoinsOptions = [
        {
          options: Object.values(config.ASSETS_CONFIG).filter(asset => asset.isStableCoin && asset.symbol !== 'USDT.e').map(asset => asset.symbol),
          key: 'asset'
        }
      ];
      setTimeout(() => {
        this.$refs.assetFilter.assetFilterGroups = this.stableCoinsOptions;
        this.$refs.assetFilter.setupFilterValue();
      });
    },
    setupShortAssetOptions() {
      this.shortAssetOptions = [];
      const shortAssets = Object.values(config.ASSETS_CONFIG).filter(asset => !asset.isStableCoin && asset.debtCoverage > 0 && config.POOLS_CONFIG[asset.symbol] && !config.POOLS_CONFIG[asset.symbol].disabled);
      shortAssets.forEach(shortAsset => {
        const shortAssetOption = {
          symbol: shortAsset.symbol,
          name: shortAsset.name,
          logo: `src/assets/logo/${shortAsset.symbol.toLowerCase()}.${shortAsset.logoExt ? shortAsset.logoExt : 'svg'}`
        };
        this.shortAssetOptions.push(shortAssetOption);
      });
    },

    setupValidators() {
      this.validators = [
        // {
        //   validate: (value) => {
        //     if (this.healthAfterTransaction < this.MIN_ALLOWED_HEALTH) {
        //       return `Health should be higher than 0%`;
        //     }
        //   },
        // }
      ];
    },

    setupStableCoinAmount() {
      const shortAssetPrice = this.assets[this.selectedShortAsset].price;
      const stableCoinPrice = this.assets[this.selectedStableCoin].price;
      this.stableCoinAmount = (1 - this.userSlippage / 100) * this.shortAssetAmount * shortAssetPrice / stableCoinPrice;
    },


    stableCoinSelectChange(changeEvent) {
      this.selectedStableCoin = changeEvent.asset[0];
      this.setupStableCoinAmount();
    },

    calculateHealthAfterTransaction() {
      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);
        if (symbol === this.selectedShortAsset) {
          borrowed += Number(this.shortAssetAmount);
        }

        if (symbol === this.selectedStableCoin) {
          balance += Number(this.stableCoinAmount);
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

      for (const [symbol, data] of Object.entries(this.levelLpAssets)) {
        tokens.push({
          price: data.price,
          balance: parseFloat(this.levelLpBalances[symbol]),
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

      let lbTokens = Object.values(this.traderJoeV2LpAssets);

      this.healthAfterTransaction = calculateHealth(tokens, lbTokens);
    },

    shortAssetInputChange(changeEvent) {
      this.selectedShortAsset = changeEvent.asset;
      this.shortAssetAmount = changeEvent.value;
      this.$refs.shortAssetInput.forceValidationCheck();
      this.setupStableCoinAmount();
      this.calculateHealthAfterTransaction();
    },

    async userSlippageChange(changeEvent) {
      this.userSlippage = changeEvent.value ? changeEvent.value : 0;
      this.setupStableCoinAmount();
    },

    submit() {
      this.transactionOngoing = true;

      this.$emit('ZAP_SHORT_EVENT',
        {
          stableCoin: this.selectedStableCoin,
          stableCoinAmount: this.stableCoinAmount,
          shortAsset: this.selectedShortAsset,
          shortAssetAmount: this.shortAssetAmount
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

.input-label {
  text-align: center;
  color: var(--modal__top-info-color);
  margin-bottom: 15px;
}

.assets-container {
  margin-bottom: 20px;

  .assets-label {
    text-align: center;
    color: var(--modal__top-info-color);
    margin-bottom: 15px;
  }

  .asset-filter-component {
    justify-content: center;
  }
}

</style>