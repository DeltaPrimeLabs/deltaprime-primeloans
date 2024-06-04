<template>
  <div id="modal" class="swap-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        <span></span>
        {{ title }}
      </div>

      <div class="dex-toggle" v-if="dexOptions && dexOptions.length > 1">
        <Toggle v-on:change="swapDexChange" :options="dexOptions"></Toggle>
      </div>


      <div class="modal-top-desc" v-if="info">
        <div>
          <b v-html="info"></b>
        </div>
      </div>

      <div class="asset-info">
        Available:
        <span v-if="sourceAssetBalance && sourceAssetData" class="asset-info__value">{{
            Number(sourceAssetBalance) | smartRound(sourceAssetData.decimals, true)
          }}</span>
      </div>

      <CurrencyComboInput ref="sourceInput"
                          :asset-options="sourceAssetOptions"
                          :default-asset="sourceAsset"
                          :validators="sourceValidators"
                          :disabled="checkingPrices"
                          :max="maxSourceValue"
                          :typingTimeout="2000"
                          v-on:valueChange="sourceInputChange"
                          v-on:ongoingTyping="ongoingTyping"
      >
      </CurrencyComboInput>

      <div class="reverse-swap-button">
        <DeltaIcon class="reverse-swap-icon" :size="22" :icon-src="'src/assets/icons/swap-arrow.svg'"></DeltaIcon>
      </div>

      <div class="target-input"
           v-for="(asset, index) of targetAssetOptions"
           v-bind:key="asset.symbol"
      >
        <CurrencyComboInput :ref="`targetInput-${index}`"
                            :asset-options="[asset]"
                            :default-asset="asset.symbol"
                            :disabled="true"
                            info-icon-message="Minimum received amount"
                            :validators="targetValidators">
        </CurrencyComboInput>
      </div>

      <div class="slippage-bar">
        <div class="slippage-info">
          <span class="slippage-label">Max. acceptable slippage:</span>
          <SimpleInput :percent="true" :default-value="userSlippage" v-on:newValue="userSlippageChange"></SimpleInput>
          <span class="percent">%</span>
        </div>
        <div class="slippage__divider"></div>
        <div class="fee" v-if="feeMethods && feeMethods[swapDex]">
          <span class="slippage-label">Max. fee:</span>
          <span class="deviation-value">{{ fee | percent }}</span>
          <div class="info__icon__wrapper">
            <InfoIcon
                class="info__icon"
                :tooltip="{content: 'The fee of underlying protocol.', placement: 'top', classes: 'info-tooltip'}"
            ></InfoIcon>
          </div>
        </div>
      </div>
      <div v-if="slippageWarning" class="slippage-warning">
        <img src="src/assets/icons/error.svg"/>
        {{ slippageWarning }}
      </div>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div class="summary__value__pair">
              <div class="summary__label"
                   v-bind:class="{'summary__label--error': healthAfterTransaction < MIN_ALLOWED_HEALTH}">
                Health:
              </div>
              <div class="summary__value">
                <span class="summary__value--error"
                      v-if="healthAfterTransaction < MIN_ALLOWED_HEALTH">
                  {{ healthAfterTransaction | percent }}
                </span>
                <span v-else>
                  {{ healthAfterTransaction | percent }}
                </span>
                <BarGaugeBeta :min="0" :max="1" :value="healthAfterTransaction" :slim="true"
                              :display-inline="true"></BarGaugeBeta>
              </div>
            </div>
            <div class="summary__divider divider--long light"></div>

            <div class="summary__value__pair">
              <div class="summary__label">
                {{ sourceName }} balance:
              </div>
              <div class="summary__value">
                {{
                  formatTokenBalance(Number(assetBalances[sourceAsset]) - Number(sourceAssetAmount)) > 0 ? formatTokenBalance(Number(assetBalances[sourceAsset]) - Number(sourceAssetAmount)) : 0
                }}
              </div>
            </div>

<!--            <div class="summary__divider divider&#45;&#45;long light"></div>-->

<!--            <div class="summary__value__pair">-->
<!--              <div class="summary__label">-->
<!--                {{ targetName }} balance:-->
<!--              </div>-->
<!--              <div class="summary__value">-->
<!--                {{ formatTokenBalance(Number(assetBalances[targetAsset]) + Number(targetAssetAmount)) }}-->
<!--              </div>-->
<!--            </div>-->
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Swap'"
                v-on:click="submit()"
                :disabled="sourceInputError || targetInputError"
                :waiting="transactionOngoing || isTyping">
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
import CurrencyComboInput from './CurrencyComboInput';
import BarGaugeBeta from './BarGaugeBeta';
import config from '../config';
import {calculateHealth, formatUnits, fromWei, parseUnits} from '../utils/calculate';
import {BigNumber} from 'ethers';
import SimpleInput from './SimpleInput';
import TOKEN_ADDRESSES from '../../common/addresses/avalanche/token_addresses.json';
import DeltaIcon from "./DeltaIcon.vue";
import InfoIcon from "./InfoIcon.vue";
import Toggle from './Toggle.vue';
import AssetsTableRow from "./AssetsTableRow.vue";
import {log} from "util";

const ethers = require('ethers');

export default {
  name: 'SwapToMultipleModal',
  components: {
    AssetsTableRow,
    Toggle,
    InfoIcon,
    DeltaIcon,
    SimpleInput,
    CurrencyComboInput,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {},

  data() {
    return {
      sourceAssets: null,
      targetAssets: null,
      sourceAssetOptions: null,
      targetAssetOptions: null,
      sourceAsset: null,
      sourceAssetData: null,
      sourceAssetBalance: 0,
      targetAssetBalances: null,
      conversionRate: null,
      sourceAssetAmount: 0,
      targetAssetAmounts: [],
      fee: 0,
      info: null,
      userSlippage: 0,
      queryMethod: null,
      feeMethods: null,
      lastChangedSource: true,
      sourceValidators: [],
      sourceWarnings: [],
      slippageWarning: '',
      targetValidators: [],
      customSourceValidators: null,
      sourceInputError: true,
      targetInputError: false,
      checkingPrices: false,
      isTyping: false,
      MIN_ALLOWED_HEALTH: config.MIN_ALLOWED_HEALTH,
      healthAfterTransaction: 0,
      assetBalances: {},
      assets: {},
      debtsPerAsset: {},
      lpAssets: {},
      lpBalances: {},
      farms: {},
      concentratedLpAssets: {},
      concentratedLpBalances: {},
      levelLpAssets: {},
      levelLpBalances: {},
      traderJoeV2LpAssets: {},
      gmxV2LpAssets: {},
      gmxV2LpBalances: {},
      penpieLpAssets: {},
      penpieLpBalances: {},
      balancerLpAssets: {},
      balancerLpBalances: {},
      wombatLpAssets: {},
      wombatLpBalances: {},
      transactionOngoing: false,
      debt: 0,
      thresholdWeightedValue: 0,
      path: null,
      adapters: null,
      maxButtonUsed: false,
      valueAsset: "USDC",
      dexOptions: null,
      swapDex: null,
      title: 'Swap',
      currentSourceInputChangeEvent: {},
      sourceAssetsConfig: config.ASSETS_CONFIG,
      targetAssetsConfig: config.ASSETS_CONFIG,
      reverseSwapDisabled: false
    };
  },

  computed: {
    maxSourceValue() {
      return this.sourceAssetBalance;
    },
    sourceName() {
      return (this.sourceAssetData && this.sourceAssetData.short) ? this.sourceAssetData.short: this.sourceAsset;
    }
  },

  methods: {
    initiate() {
      this.setupSourceAssetOptions();
      this.setupTargetAssetOptions();
      this.sourceAssetData = this.sourceAssetsConfig[this.sourceAsset];
      this.setupValidators();
      this.setupWarnings();
      this.calculateHealthAfterTransaction();
    },

    submit() {
      this.transactionOngoing = true;
      const sourceAssetAmount = this.maxButtonUsed ? this.sourceAssetAmount * config.MAX_BUTTON_MULTIPLIER : this.sourceAssetAmount;
      this.$emit('SWAP_TO_MULTIPLE', {
        sourceAsset: this.sourceAsset,
        targetAssets: this.targetAssets[this.swapDex],
        sourceAmount: sourceAssetAmount,
        targetAmounts: this.targetAssetAmounts,
        path: this.path,
        adapters: this.adapters,
        swapDex: this.swapDex
      });
    },

    swapDexChange(dex) {
      this.swapDex = dex;
      this.setupSourceAssetOptions();
      this.setupTargetAssetOptions();
      if (this.currentSourceInputChangeEvent.value) {
        this.sourceInputChange(this.currentSourceInputChangeEvent);
      }
    },

    async query(sourceAsset, targetAsset, amountIn) {
      return await this.queryMethods[this.swapDex](sourceAsset, targetAsset, amountIn);
    },

    async chooseBestTrade(basedOnSource = true) {
      console.log('chooseBestTrade')
      if (this.sourceAssetAmount == null) return;
      if (this.sourceAssetAmount === 0) {
        this.targetAssetAmount = 0;
        return;
      }

      this.lastChangedSource = true;
      let decimals = this.sourceAssetData.decimals;
      let amountInWei = parseUnits(this.sourceAssetAmount.toFixed(decimals), BigNumber.from(decimals));

      const queryResponse = await this.query(this.sourceAsset, this.targetAsset, amountInWei);

      if (this.feeMethods && this.feeMethods[this.swapDex]) {
        this.fee = fromWei(await this.feeMethods[this.swapDex](this.sourceAsset, this.targetAssets[this.swapDex], amountInWei), this.sourceAssetData.decimals);
      }

      if (queryResponse) {
        let estimatedReceived = queryResponse.map((amount, i) =>
        {
          return parseFloat(formatUnits(amount, this.targetConfig(i).decimals))
        }
        );

        if (this.feeMethods && this.feeMethods[this.swapDex]) {

          estimatedReceived.forEach(
              received => received - this.fee * received
          )
        }

        this.updateAmountsWithSlippage(estimatedReceived);

        this.calculateHealthAfterTransaction();
      }
    },

    targetConfig(i) {
      return this.targetAssetsConfig[(this.targetAssets[this.swapDex])[i]];
    },

    async updateAmountsWithSlippage(estimatedReceivedTokens) {
      this.targetAssets[this.swapDex].forEach(
          async (asset, index) => {
            this.targetAssetAmounts[index] = estimatedReceivedTokens[index] * (1 - (this.userSlippage / 100 + (this.fee ? this.fee : 0)));

            if (this.$refs[`targetInput-${index}`] && this.$refs[`targetInput-${index}`][0]) {
              await (this.$refs[`targetInput-${index}`][0]).setCurrencyInputValue(this.targetAssetAmounts[index]);
            }
          }
      );

      this.setSlippageWarning();
    },

    setSlippageWarning() {
      this.slippageWarning = '';
      if (this.userSlippage > 2) {
        this.slippageWarning = 'Slippage exceeds 2%. Be careful.';
      }
    },

    setupSourceAssetOptions() {
      this.sourceAssetOptions = [];
      const sourceAssets = this.sourceAssets[this.swapDex];
      sourceAssets.forEach(assetSymbol => {
        const asset = this.sourceAssetsConfig[assetSymbol];
        const assetOption = {
          symbol: assetSymbol,
          short: asset.short,
          name: asset.name,
          logo: `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
        };
        this.sourceAssetOptions.push(assetOption);
      });
    },

    setupTargetAssetOptions() {
      this.targetAssetOptions = [];

      const targetAssets = this.targetAssets[this.swapDex];
      targetAssets.forEach(assetSymbol => {
        const asset = this.targetAssetsConfig[assetSymbol];
        const assetOption = {
          symbol: assetSymbol,
          short: asset.short,
          name: asset.name,
          logo: `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
        };
        this.targetAssetOptions.push(assetOption);
      });

      this.targetAssetOptions = this.targetAssetOptions.filter(option => option.symbol !== this.sourceAsset);
    },

    async sourceInputChange(changeEvent) {
      this.currentSourceInputChangeEvent = changeEvent;
      this.maxButtonUsed = changeEvent.maxButtonUsed;
      this.checkingPrices = true;
      let targetInputChangeEvent;
      if (changeEvent.asset === this.targetAsset) {
        this.reverseSwap();
      } else {
        if (this.sourceAsset !== changeEvent.asset) {
          this.sourceAsset = changeEvent.asset;
          this.calculateSourceAssetBalance();
          this.sourceAssetData = this.sourceAssetsConfig[this.sourceAsset];
          await this.chooseBestTrade(false);
        } else {
          let value = Number.isNaN(changeEvent.value) ? 0 : changeEvent.value;
          this.sourceAssetAmount = value;

          if (value !== 0) {
            await this.chooseBestTrade();
          } else {
            this.targetAssets[this.swapDex].forEach(
                async (target, index) => {
                  this.targetAssetAmounts[index] = 0;
                  this.estimatedReceivedTokens[index] = 0;
                  await this.$refs[`targetInput-${index}`].setCurrencyInputValue(0);
                }
            )
          }
        }
      }

      this.sourceInputError = changeEvent.error;
      if (targetInputChangeEvent) {
        this.targetInputError = targetInputChangeEvent.error;
      }
      this.checkingPrices = false;
    },

    ongoingTyping(event) {
      this.isTyping = event.typing;
    },

    async userSlippageChange(changeEvent) {
      console.log('userSlippageChange')
      this.userSlippage = changeEvent.value ? changeEvent.value : 0;

      await this.updateAmountsWithSlippage(this.targetAssetAmounts);
    },

    calculateSourceAssetBalance() {
      const sourceAssetBalance = this.assetBalances[this.sourceAsset];
      this.sourceAssetBalance = sourceAssetBalance;
    },

    async delay(ms) {
      return new Promise(res => setTimeout(res, ms));
    },
    setupWarnings() {
    },
    setupValidators() {
      this.sourceValidators = [
        {
          validate: async (value) => {
            if (value > parseFloat(this.assetBalances[this.sourceAsset])) {
              return 'Amount exceeds the current balance.';
            }
          },
        }
      ];
      this.targetValidators = [
        {
          validate: async (value) => {
            if (this.healthAfterTransaction < this.MIN_ALLOWED_HEALTH) {
              return 'The health is below allowed limit.';
            }
          }
        },
        {
          validate: async (value) => {
            const allowed = this.targetAssetsConfig[this.targetAsset].maxExposure - this.targetAssetsConfig[this.targetAsset].currentExposure;

            if (value > allowed) {
              return `Max. allowed amount is ${allowed.toFixed(2)}.`;
            }
          }
        }
      ];

      if (this.customSourceValidators) {
        this.sourceValidators.push(...this.customSourceValidators);
      }
    },

    calculateHealthAfterTransaction() {
      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);
        console.log('this.sourceAsset: ', this.sourceAsset)
        console.log('symbol: ', symbol)
        if (symbol === this.sourceAsset) {
          console.log('decreasing')
          console.log('this.sourceAssetAmount: ', this.sourceAssetAmount)
          console.log('this.sourceAsset: ', this.sourceAsset)
          console.log(this.sourceAsset)
          balance -= this.sourceAssetAmount;
        }

        if (this.targetAssets[this.swapDex].includes(symbol)) {
          balance += this.targetAssetAmounts[this.targetAssets[this.swapDex].indexOf(symbol)];
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
          debtCoverage: data.debtCoverage,
          symbol: symbol
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
        let balance = parseFloat(this.gmxV2Balances[symbol])
        if (symbol === this.sourceAsset) {
          balance -= this.sourceAssetAmount;
        }

        tokens.push({
          price: data.price,
          balance: balance,
          borrowed: 0,
          debtCoverage: data.debtCoverage
        });
      }

      if (this.penpieLpAssets) {
        for (const [symbol, data] of Object.entries(this.penpieLpAssets)) {
          if (this.penpieLpBalances) {
            let balance = parseFloat(this.penpieLpBalances[symbol]);
            tokens.push({
              price: data.price,
              balance: balance ? balance : 0,
              borrowed: 0,
              debtCoverage: data.debtCoverage
            });
          }
        }
      }

      if (this.wombatLpAssets) {
        for (const [symbol, data] of Object.entries(this.wombatLpAssets)) {
          if (this.wombatLpBalances) {
            let balance = parseFloat(this.wombatLpBalances[symbol]);
            tokens.push({
              price: data.price,
              balance: balance ? balance : 0,
              borrowed: 0,
              debtCoverage: data.debtCoverage
            });
          }
        }
      }

      for (const [, farms] of Object.entries(this.farms)) {
        farms.forEach(farm => {
          tokens.push({
            price: farm.price,
            balance: typeof farm.totalBalance === 'string' ? parseFloat(farm.totalBalance) : farm.totalBalance,
            borrowed: 0,
            debtCoverage: farm.debtCoverage
          });
        });
      }

      console.log(tokens)

      let lbTokens = Object.values(this.traderJoeV2LpAssets);

      this.healthAfterTransaction = calculateHealth(tokens, lbTokens);
    },
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

  .modal-top-desc {
    margin-bottom: 20px;
  }

  .asset-info {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    font-size: $font-size-xsm;
    color: var(--swap-modal__asset-info-color);
    padding-right: 8px;

    .asset-info__value {
      font-weight: 600;
      margin-left: 5px;
    }
  }

  .usd-info {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    font-size: $font-size-xsm;
    color: var(--swap-modal__usd-info-color);
    margin-top: 3px;

    .asset-info__value {
      margin-left: 5px;
    }

    .price-info__value {
      font-weight: 600;
    }
  }
}

.received-amount {
  display: flex;
  font-size: 14px;
  color: var(--swap-modal__received-amount-color);
}

.target-input {
  margin-top: 20px;
}

.target-asset-info {
  display: flex;
  justify-content: flex-end;
}

.bar-gauge-tall-wrapper {
  padding-top: 5px;
}

.slippage-warning {
  color: var(--swap-modal__slippage-warning-color);
  margin-top: 4px;

  img {
    width: 20px;
    height: 20px;
    transform: translateY(-1px);
  }
}

.dex-toggle {
  margin-bottom: 30px;
}

.reverse-swap-button {
  position: relative;
  cursor: pointer;
  margin: 28px auto;
  height: 40px;
  width: 40px;
  border: var(--swap-modal__reverse-swap-button-border);
  background: var(--swap-modal__reverse-swap-button-background);
  box-shadow: var(--swap-modal__reverse-swap-button-box-shadow);
  border-radius: 999px;

  .reverse-swap-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--swap-modal__reverse-swap-icon-color);
  }
}
</style>
