<template>
  <div id="modal" class="zap-long-modal-component modal-component">
    <Modal :height="'1200px'">
      <div class="modal__title">
        Long
      </div>

      <div class="modal__content">
        <div class="checkbox-container">
          <Checkbox :label="'Include funds from your wallet'" v-on:checkboxChange="addFromWalletCheckboxChange"></Checkbox>
        </div>

        <div class="modal-top-info">
          <div class="top-info__label">Available:</div>
          <div class="top-info__value" v-bind:class="{'available-balance--loading': !availableAssetAmount}">
            <LoadedValue :check="() => availableAssetAmount != null"
                         :value="formatTokenBalance(availableAssetAmount, 10, true)">
            </LoadedValue>
            <div v-if="availableAssetAmount">
              <span class="top-info__currency">
                {{selectedStableCoin}}
              </span>
            </div>
          </div>
        </div>
        <div class="top-up-input">
          <CurrencyComboInput ref="stableCoinInput"
                              :asset-options="stableCoinsOptions"
                              :default-asset="'USDC'"
                              :typingTimeout="100"
                              :validators="validators"
                              v-on:valueChange="stableCoinInputChange"
          >
          </CurrencyComboInput>
        </div>

        <div class="assets-container">
          <div class="assets-label">Choose asset to long:</div>
          <AssetFilter ref="assetFilter"
                       :asset-filter-groups="longAssetOptions"
                       :show-clear-button="false"
                       :single-select-mode="true"
                       v-on:filterChange="assetSelectChange">
          </AssetFilter>
        </div>

        <div class="leverage">
          Leverage: {{leverage}}x
        </div>
        <div class="slider-container">
          <Slider :min="1" :max="selectedLongAsset ? Math.round((1 / (1 - assets[selectedLongAsset].debtCoverage) - 1)) : 1" :step="0.1" v-on:newValue="leverageChange"></Slider>
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
                {{selectedLongAsset}} bought:
              </div>
              <div class="summary__value">
                {{longPositionTokenAmount}}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>


      <div class="button-wrapper">
        <Button :disabled="!(stableCoinAmount && selectedLongAsset && leverage)" :waiting="transactionOngoing" :label="'Long'" v-on:click="submit()"></Button>
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
  name: 'ZapLongModal',
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
      traderJoeV2LpAssets: {},
      farms: {},
      debtsPerAsset: {},
      thresholdWeightedValue: Number,
      toggleOptions: ['Top up', 'Existing funds'],
      stableCoinsOptions: null,
      longAssetOptions: [],
      healthAfterTransaction: 0,
      MIN_ALLOWED_HEALTH: config.MIN_ALLOWED_HEALTH,
      selectedStableCoin: 'USDC',
      availableAssetAmount: 0,
      includeBalanceFromWallet: false,
      validators: [],
      leverage: null,
      stableCoinAmount: 0,
      extraDepositRequired: 0,
      selectedLongAsset: null,
      longPositionValue: 0,
      longPositionTokenAmount: 0,
      transactionOngoing: false
    };
  },

  mounted() {
    this.setupStableCoinsOptions();
    this.setupLongAssetOptions();
    setTimeout(() => {
      this.setupAvailableAssetAmount();
      this.setupValidators();
      this.calculateHealthAfterTransaction();
      console.log(this.assets);
    });
  },


  computed: {},

  methods: {
    setupStableCoinsOptions() {
      this.stableCoinsOptions = [];
      const stableCoins = Object.values(config.ASSETS_CONFIG).filter(asset => asset.isStableCoin);
      stableCoins.forEach(stableCoin => {
        const stableCoinOption = {
          symbol: stableCoin.symbol,
          name: stableCoin.name,
          logo: `src/assets/logo/${stableCoin.symbol.toLowerCase()}.${stableCoin.logoExt ? stableCoin.logoExt : 'svg'}`
        };
        this.stableCoinsOptions.push(stableCoinOption);
      });
    },

    setupLongAssetOptions() {
      this.longAssetOptions = [
        {
          options: Object.values(config.ASSETS_CONFIG).filter(asset => !asset.isStableCoin && asset.debtCoverage > 0).map(asset => asset.symbol),
          key: 'asset'
        }
      ];
      setTimeout(() => {
        this.$refs.assetFilter.assetFilterGroups = this.longAssetOptions;
        this.$refs.assetFilter.setupFilterValue();
      });
    },

    setupAvailableAssetAmount() {
      if (this.includeBalanceFromWallet) {
        this.availableAssetAmount = Number(this.stableCoinsWalletBalances[this.selectedStableCoin]) + Number(this.accountAssetBalances[this.selectedStableCoin]);
      } else {
        this.availableAssetAmount = this.accountAssetBalances[this.selectedStableCoin];
      }
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
        {
          validate: (value) => {
            if (value > Number(this.availableAssetAmount)) {
              return 'Amount exceeds available balance.';
            }
          }
        }
      ];
    },

    leverageChange(leverage) {
      this.leverage = leverage.value;
      console.log(leverage);
      this.calculateHealthAfterTransaction();
      this.setupLongPositionDetails();
    },

    calculateHealthAfterTransaction() {
      let addedBorrow = this.value ? this.value : 0;

      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);
        if (symbol === this.selectedStableCoin) {
          borrowed += Number(this.stableCoinAmount) * (this.leverage - 1);
          balance += Number(this.stableCoinAmount) * this.leverage;
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

      let lbTokens = Object.values(this.traderJoeV2LpAssets);

      this.healthAfterTransaction = calculateHealth(tokens, lbTokens);
    },

    stableCoinInputChange(changeEvent) {
      console.log(this.assets['BTC'].price);
      console.log(changeEvent);
      this.selectedStableCoin = changeEvent.asset;
      this.stableCoinAmount = changeEvent.value;
      this.setupAvailableAssetAmount();
      if (changeEvent.value > Number(this.accountAssetBalances[this.selectedStableCoin])) {
        this.extraDepositRequired = (Number(changeEvent.value) - Number(this.accountAssetBalances[this.selectedStableCoin])) * 1.02;
      } else {
        this.extraDepositRequired = 0;
      }
      console.log('this.extraDepositRequired', this.extraDepositRequired);
      this.$refs.stableCoinInput.forceValidationCheck();
      this.calculateHealthAfterTransaction();
      this.setupLongPositionDetails();
    },

    addFromWalletCheckboxChange(changeEvent) {
      this.includeBalanceFromWallet = changeEvent;
      console.log('this.includeBalanceFromWallet', this.includeBalanceFromWallet);
      this.setupAvailableAssetAmount();
      this.$refs.stableCoinInput.forceValidationCheck();
    },

    assetSelectChange(changeEvent) {
      this.selectedLongAsset = changeEvent.asset[0];
      this.setupLongPositionDetails();
    },

    setupLongPositionDetails() {
      this.longPositionValue = Number(this.stableCoinAmount) * this.leverage;
      this.longPositionTokenAmount = this.longPositionValue / this.assets[this.selectedLongAsset].price;
    },

    submit() {
      const depositAmount = this.stableCoinAmount > Number(this.accountAssetBalances[this.selectedStableCoin]) ?
        (Number(this.stableCoinAmount) - Number(this.accountAssetBalances[this.selectedStableCoin])) * 1.02 : 0;
      this.transactionOngoing = true;
      this.$emit('ZAP_LONG_EVENT',
        {
          stableCoin: this.selectedStableCoin,
          longAsset: this.selectedLongAsset,
          stableCoinAmount: this.stableCoinAmount,
          leverage: this.leverage,
          depositAmount: depositAmount
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

  .assets-label {
    text-align: center;
    color: var(--modal__top-info-color);
    margin-bottom: 15px;
  }

  .asset-filter-component {
    justify-content: center;
  }
}

.leverage {
  color: var(--modal__top-info-color);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: $font-size-lg;
  margin-bottom: 20px;
}

.slider-container {
  margin-bottom: 20px;

}

</style>