<template>
  <div id="modal" class="zap-long-modal-component modal-component">
    <Modal :height="'1200px'">
      <div class="modal__title">
        Long
      </div>

      <div class="modal__content">
        <span class="modal-top-desc">Borrows stablecoin and swaps into the chosen asset.</span>

        <div class="assets-container">
          <div class="modal-label">Choose asset to borrow:</div>
          <AssetFilter ref="assetFilter"
                       :asset-filter-groups="stableCoinsOptions"
                       :first-one-as-default="true"
                       :show-clear-button="false"
                       :single-select-mode="true"
                       v-on:filterChange="stableCoinSelectChange">
          </AssetFilter>
        </div>

        <div class="top-up-input">
          <div class="modal-label">Choose asset to long:</div>
          <CurrencyComboInput ref="longAssetInput"
                              :asset-options="longAssetOptions"
                              :typingTimeout="100"
                              :validators="validators"
                              v-on:valueChange="longAssetInputChange"
          >
          </CurrencyComboInput>
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
                {{selectedStableCoin}} borrowed:
              </div>
              <div class="summary__value">
                {{stableCoinAmount.toFixed(6)}}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>


      <div class="button-wrapper">
        <Button :disabled="!(stableCoinAmount && selectedLongAsset)" :waiting="transactionOngoing" :label="'Long'" v-on:click="submit()"></Button>
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

export default {
  name: 'ZapLongModal',
  components: {
    SimpleInput,
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
      gmxV2Assets: {},
      gmxV2Balances: {},
      balancerLpAssets: {},
      balancerLpBalances: {},
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
      userSlippage: 3,
      stableCoinAmount: 0,
      extraDepositRequired: 0,
      selectedLongAsset: null,
      longAssetAmount: 0,
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
      this.stableCoinsOptions = [
        {
          options: Object.values(config.ASSETS_CONFIG).filter(asset => asset.isStableCoin && config.POOLS_CONFIG[asset.symbol] && !config.POOLS_CONFIG[asset.symbol].disabled).map(asset => asset.symbol),
          key: 'asset'
        }
      ];

      setTimeout(() => {
        this.$refs.assetFilter.assetFilterGroups = this.stableCoinsOptions;
        this.$refs.assetFilter.setupFilterValue();
      });
    },

    setupLongAssetOptions() {
      this.longAssetOptions = [];

      const options = Object.values(config.ASSETS_CONFIG).filter(asset => !asset.isStableCoin && asset.debtCoverage > 0);
      options.forEach(asset => {
        const assetOption = {
          symbol: asset.symbol,
          name: asset.name,
          logo: `src/assets/logo/${asset.symbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
        };
        this.longAssetOptions.push(assetOption);
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
        // {
        //   validate: (value) => {
        //     if (this.healthAfterTransaction < this.MIN_ALLOWED_HEALTH) {
        //       return `Health should be higher than 0%`;
        //     }
        //   },
        // }
      ];
    },

    calculateHealthAfterTransaction() {
      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);
        if (symbol === this.selectedStableCoin) {
          console.log('this.stableCoinAmount: ', this.stableCoinAmount)
          borrowed += Number(this.stableCoinAmount);
        }

        if (symbol === this.selectedLongAsset) {
          console.log('this.longAssetAmount: ', this.longAssetAmount)
          balance += Number(this.longAssetAmount);
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

      for (const [symbol, data] of Object.entries(this.balancerLpAssets)) {
        if (this.balancerLpBalances) {
          let balance = parseFloat(this.balancerLpBalances[symbol]);

          tokens.push({price: data.price, balance: balance ? balance : 0, borrowed: 0, debtCoverage: data.debtCoverage});
        }
      }

      for (const [symbol, data] of Object.entries(this.gmxV2Assets)) {
        tokens.push({
          price: data.price,
          balance: parseFloat(this.gmxV2Balances[symbol]),
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

    longAssetInputChange(changeEvent) {
      this.selectedLongAsset = changeEvent.asset;
      this.longAssetAmount = changeEvent.value;
      this.setupStableCoinAmount();

      this.$refs.longAssetInput.forceValidationCheck();
      this.calculateHealthAfterTransaction();
    },

    stableCoinSelectChange(changeEvent) {
      this.selectedStableCoin = changeEvent.asset[0];
      this.setupStableCoinAmount();
    },

    setupStableCoinAmount() {
      this.stableCoinAmount = (1 + this.userSlippage / 100) * this.longAssetAmount * this.assets[this.selectedLongAsset].price;
    },

    async userSlippageChange(changeEvent) {
      this.userSlippage = changeEvent.value ? changeEvent.value : 0;
      this.setupStableCoinAmount();
    },

    submit() {
      this.transactionOngoing = true;
      this.$emit('ZAP_LONG_EVENT',
        {
          stableCoin: this.selectedStableCoin,
          longAsset: this.selectedLongAsset,
          stableCoinAmount: this.stableCoinAmount,
          longAssetAmount: this.longAssetAmount
        }
      );
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";


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
.modal-top-desc {
  margin-bottom: 20px;
}
.modal-label {
  text-align: center;
  color: var(--modal__top-info-color);
  margin-bottom: 15px;
}

.slider-container {
  margin-bottom: 20px;

}

</style>
