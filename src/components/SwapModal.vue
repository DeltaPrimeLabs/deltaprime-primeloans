<template>
  <div id="modal" class="swap-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        <span></span>
        {{ title }}
      </div>

      <div class="dex-toggle" v-if="!swapDebtMode && dexOptions && dexOptions.length > 1">
        <Toggle v-on:change="swapDexChange" :options="dexOptions"></Toggle>
      </div>

      <div class="modal-top-desc" v-if="swapDex === 'ParaSwap' && showParaSwapWarning">
        <div>
          <b>Caution: Paraswap slippage vastly exceeds YakSwap. Use with caution.</b>
        </div>
      </div>

      <div class="modal-top-desc" v-if="swapDex === 'YakSwap' && showYakSwapWarning">
        <div>
          <b>We recommend using Paraswap for swaps of $50K+.</b>
        </div>
      </div>

      <div class="asset-info" v-if="!swapDebtMode">
        Available:
        <span v-if="sourceAssetBalance" class="asset-info__value">{{
            Number(sourceAssetBalance) | smartRound(10, true)
          }}</span>
      </div>
      <div class="asset-info" v-if="swapDebtMode">
        Borrowed:
        <span v-if="sourceAssetDebt" class="asset-info__value">{{
            Number(sourceAssetDebt) | smartRound(10, true)
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

      <div class="reverse-swap-button" v-on:click="reverseSwap">
        <DeltaIcon class="reverse-swap-icon" :size="22" :icon-src="'src/assets/icons/swap-arrow.svg'"></DeltaIcon>
      </div>

      <CurrencyComboInput ref="targetInput"
                          :asset-options="targetAssetOptions"
                          :default-asset="targetAsset"
                          v-on:valueChange="targetInputChange"
                          :disabled="true"
                          info-icon-message="Minimum received amount"
                          :validators="targetValidators">
      </CurrencyComboInput>
      <div class="target-asset-info">
        <div class="usd-info">
          Price:&nbsp;<span
            class="price-info__value">1 {{
            targetAsset
          }} = {{ estimatedNeededTokens / estimatedReceivedTokens | smartRound }} {{ sourceAsset }}</span>
        </div>
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
        <div class="dex-slippage" v-else>
          <span class="slippage-label">DEX slippage:</span>
          <span class="deviation-value">{{ marketDeviation }}<span class="percent">%</span></span>
          <div class="info__icon__wrapper">
            <InfoIcon
                class="info__icon"
                :tooltip="{content: 'The difference between DEX and market prices.', placement: 'top', classes: 'info-tooltip'}"
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

            <div class="summary__value__pair" v-if="!swapDebtMode">
              <div class="summary__label">
                {{ sourceAsset }} balance:
              </div>
              <div class="summary__value">
                {{
                  formatTokenBalance(Number(assetBalances[sourceAsset]) - Number(sourceAssetAmount)) > 0 ? formatTokenBalance(Number(assetBalances[sourceAsset]) - Number(sourceAssetAmount)) : 0
                }}
              </div>
            </div>

            <div class="summary__value__pair" v-if="swapDebtMode">
              <div class="summary__label">
                {{ sourceAsset }} borrowed:
              </div>
              <div class="summary__value">
                {{
                  formatTokenBalance(Number(debtsPerAsset[sourceAsset].debt) - Number(sourceAssetAmount)) > 0 ? formatTokenBalance(Number(debtsPerAsset[sourceAsset].debt) - Number(sourceAssetAmount)) : 0
                }}
              </div>
            </div>

            <div class="summary__divider divider--long light"></div>

            <div class="summary__value__pair" v-if="!swapDebtMode">
              <div class="summary__label">
                {{ targetAsset }} balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(Number(assetBalances[targetAsset]) + Number(targetAssetAmount)) }}
              </div>
            </div>

            <div class="summary__value__pair" v-if="swapDebtMode">
              <div class="summary__label">
                {{ targetAsset }} borrowed:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(Number(debtsPerAsset[targetAsset].debt) + Number(targetAssetAmount)) }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="swapDebtMode ? 'Swap debt' : 'Swap'"
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
import {calculateHealth, formatUnits, parseUnits} from '../utils/calculate';
import {BigNumber} from 'ethers';
import SimpleInput from './SimpleInput';
import TOKEN_ADDRESSES from '../../common/addresses/avalanche/token_addresses.json';
import DeltaIcon from "./DeltaIcon.vue";
import InfoIcon from "./InfoIcon.vue";
import Toggle from './Toggle.vue';

const ethers = require('ethers');

export default {
  name: 'SwapModal',
  components: {
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
      swapDebtMode: null,
      sourceAssets: null,
      targetAssets: null,
      sourceAssetOptions: null,
      targetAssetOptions: null,
      sourceAsset: null,
      targetAsset: null,
      sourceAssetData: null,
      targetAssetData: null,
      sourceAssetBalance: 0,
      sourceAssetDebt: 0,
      targetAssetBalance: null,
      conversionRate: null,
      sourceAssetAmount: 0,
      targetAssetAmount: 0,
      fee: 0,
      userSlippage: 0,
      queryMethod: null,
      feeMethods: null,
      lastChangedSource: true,
      sourceValidators: [],
      sourceWarnings: [],
      slippageWarning: '',
      targetValidators: [],
      sourceInputError: true,
      targetInputError: false,
      checkingPrices: false,
      isTyping: false,
      marketDeviation: 0,
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
      transactionOngoing: false,
      debt: 0,
      thresholdWeightedValue: 0,
      estimatedReceivedTokens: 0,
      estimatedNeededTokens: 0,
      receivedAccordingToOracle: 0,
      neededAccordingToOracle: 0,
      path: null,
      adapters: null,
      maxButtonUsed: false,
      valueAsset: "USDC",
      paraSwapRate: {},
      dexOptions: null,
      swapDex: null,
      title: 'Swap',
      currentSourceInputChangeEvent: {},
      showParaSwapWarning: config.showParaSwapWarning,
      showYakSwapWarning: config.showYakSwapWarning,
      sourceAssetsConfig: config.ASSETS_CONFIG,
      targetAssetsConfig: config.ASSETS_CONFIG
    };
  },

  computed: {
    maxSourceValue() {
      if (this.swapDebtMode) {
        return this.sourceAssetDebt;
      } else {
        return this.sourceAssetBalance;
      }
    },
  },

  methods: {
    initiate() {
      if (this.swapDebtMode && !this.swapDex) {
        this.swapDex = 'YakSwap'
      }
      this.setupSourceAssetOptions();
      this.setupTargetAssetOptions();
      this.setupSourceAsset();
      this.setupTargetAsset();
      this.setupValidators();
      this.setupWarnings();
      this.calculateHealthAfterTransaction();
    },

    submit() {
      this.transactionOngoing = true;
      const sourceAssetAmount = this.maxButtonUsed ? this.sourceAssetAmount * config.MAX_BUTTON_MULTIPLIER : this.sourceAssetAmount;
      this.$emit('SWAP', {
        sourceAsset: this.sourceAsset,
        targetAsset: this.targetAsset,
        sourceAmount: sourceAssetAmount,
        targetAmount: this.targetAssetAmount,
        path: this.path,
        adapters: this.adapters,
        paraSwapRate: this.paraSwapRate,
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
      if (this.swapDebtMode) {
        return await this.queryMethod(sourceAsset, targetAsset, amountIn);
      } else {
        return await this.queryMethods[this.swapDex](sourceAsset, targetAsset, amountIn);
      }
    },

    async chooseBestTrade(basedOnSource = true) {
      if (this.sourceAssetAmount == null) return;
      if (this.sourceAssetAmount === 0) {
        this.targetAssetAmount = 0;
        return;
      }

      this.lastChangedSource = true;
      let decimals = this.sourceAssetData.decimals;
      let amountInWei = parseUnits(this.sourceAssetAmount.toFixed(decimals), BigNumber.from(decimals));

      const queryResponse = await this.query(this.sourceAsset, this.targetAsset, amountInWei);

      let estimated;
      if (queryResponse) {
        if (queryResponse.dex === 'PARA_SWAP') {
          estimated = queryResponse.amounts[queryResponse.amounts.length - 1];
          this.paraSwapRate = queryResponse.swapRate;
        } else if (queryResponse.dex === 'YAK_SWAP') {
          if (queryResponse instanceof BigNumber) {
            estimated = queryResponse;
          } else {
            this.path = queryResponse.path;
            this.adapters = queryResponse.adapters;
            estimated = queryResponse.amounts[queryResponse.amounts.length - 1];
          }
        } else {
          estimated = queryResponse;
        }

        let estimatedReceived = parseFloat(formatUnits(estimated, BigNumber.from(this.targetAssetData.decimals)));

        this.updateSlippageWithAmounts(estimatedReceived);

        if (this.feeMethods && this.feeMethods[this.swapDex]) {
          this.fee = await this.feeMethods[this.swapDex]();
          estimatedReceived -= this.fee * estimatedReceived;
        }

        this.calculateHealthAfterTransaction();
      }
    },

    async updateAmountsWithSlippage() {

      if (!this.swapDebtMode) {
        this.targetAssetAmount = this.receivedAccordingToOracle * (1 - (this.userSlippage / 100 + (this.fee ? this.fee : 0)));
      } else {
        this.targetAssetAmount = this.receivedAccordingToOracle * (1 + (this.userSlippage / 100 + (this.fee ? this.fee : 0)));
      }

      console.log('this.targetAssetAmount 2: ', this.targetAssetAmount)

      const targetInputChangeEvent = await this.$refs.targetInput.setCurrencyInputValue(this.targetAssetAmount);

      this.estimatedReceivedTokens = this.targetAssetAmount;

      this.setSlippageWarning();
    },

    async updateSlippageWithAmounts(estimatedReceivedTokens) {
      console.log('updateSlippageWithAmounts')
      console.log('estimatedReceivedTokens: ', estimatedReceivedTokens)
      let dexSlippage = 0;
      this.receivedAccordingToOracle = this.estimatedNeededTokens * this.sourceAssetData.price / this.targetAssetData.price;
      dexSlippage = (this.receivedAccordingToOracle - estimatedReceivedTokens) / estimatedReceivedTokens;

      let slippageMargin = this.swapDebtMode ? 0.2 : 0.1;

      if (this.swapDebtMode) {
        slippageMargin = 0.2
      } else {
        if (this.swapDex === 'ParaSwap') {
          slippageMargin = config.paraSwapDefaultSlippage;
        } else {
          slippageMargin = 0.1
        }
      }

      this.marketDeviation = parseFloat((100 * dexSlippage).toFixed(3));

      let updatedSlippage = slippageMargin + 100 * dexSlippage;

      this.userSlippage = parseFloat(updatedSlippage.toFixed(3));

      console.log('slippageMargin: ', slippageMargin)
      console.log('dexSlippage: ', dexSlippage)
      console.log('this.userSlippage: ', this.userSlippage)

      await this.updateAmountsWithSlippage();
    },

    setSlippageWarning() {
      this.slippageWarning = '';
      if (this.userSlippage > 2) {
        this.slippageWarning = 'Slippage exceeds 2%. Be careful.';
      } else if (this.userSlippage < this.marketDeviation) {
        this.slippageWarning = 'Slippage below current DEX slippage. Transaction will likely fail.';
      } else if (parseFloat((this.userSlippage - this.marketDeviation).toFixed(3)) < 0.1) {
        this.slippageWarning = 'Slippage close to current DEX slippage. Transaction can fail.';
      }
    },

    setupSourceAssetOptions() {
      this.sourceAssetOptions = [];
      const sourceAssets = this.swapDebtMode ? this.sourceAssets : this.sourceAssets[this.swapDex];
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

      const targetAssets = this.swapDebtMode ? this.targetAssets : this.targetAssets[this.swapDex];
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

    setupSourceAsset() {
      this.sourceAssetData = this.sourceAssetsConfig[this.sourceAsset];
    },

    setupTargetAsset() {
      if (this.targetAsset) {
        this.targetAssetData = this.targetAssetsConfig[this.targetAsset];
      }
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
          this.estimatedNeededTokens = value;

          if (value !== 0) {
            await this.chooseBestTrade();
          } else {
            this.targetAssetAmount = 0;
            this.estimatedReceivedTokens = 0;
            await this.$refs.targetInput.setCurrencyInputValue(0);
          }
        }
      }

      this.sourceInputError = changeEvent.error;
      if (targetInputChangeEvent) {
        this.targetInputError = targetInputChangeEvent.error;
      }
      this.checkingPrices = false;
    },

    async targetInputChange(changeEvent) {
      let sourceInputChangeEvent;

      if (changeEvent.asset === this.sourceAsset) {
        this.reverseSwap();
      } else {
        if (this.targetAsset !== changeEvent.asset) {
          this.targetAsset = changeEvent.asset;
          this.targetAssetData = this.targetAssetsConfig[this.targetAsset];
          await this.chooseBestTrade(true);
        } else {
          this.targetAssetAmount = changeEvent.value;
          this.estimatedReceivedTokens = changeEvent.value;
          await this.chooseBestTrade(false);
        }

      }
      this.targetInputError = changeEvent.error;
      if (sourceInputChangeEvent) {
        this.sourceInputError = sourceInputChangeEvent.error;
      }
    },

    ongoingTyping(event) {
      this.isTyping = event.typing;
    },

    async userSlippageChange(changeEvent) {
      this.userSlippage = changeEvent.value ? changeEvent.value : 0;

      await this.updateAmountsWithSlippage();
    },

    calculateSourceAssetBalance() {
      console.log('calculateSourceAssetBalance')
      console.log(this.assetBalances)
      console.log(this.sourceAsset)
      const sourceAssetBalance = this.assetBalances[this.sourceAsset];
      this.sourceAssetBalance = sourceAssetBalance;
    },

    async delay(ms) {
      return new Promise(res => setTimeout(res, ms));
    },

    reverseSwap() {
      const tempSource = this.sourceAsset;
      this.sourceAssetData = this.sourceAssetsConfig[this.targetAsset];
      this.targetAssetData = this.targetAssetsConfig[this.sourceAsset];
      this.sourceAsset = this.targetAsset;
      this.targetAsset = tempSource;

      const tempSourceAssetsOptions = this.sourceAssetOptions;
      this.sourceAssetOptions = this.targetAssetOptions;
      this.targetAssetOptions = tempSourceAssetsOptions;

      this.setupSourceAsset();
      this.setupTargetAsset();

      this.chooseBestTrade();

      this.calculateSourceAssetBalance();
    },
    setupWarnings() {
    },
    setupValidators() {
      this.sourceValidators = [
        {
          validate: async (value) => {
            if (!this.swapDebtMode) {
              if (value > parseFloat(this.assetBalances[this.sourceAsset])) {
                return 'Amount exceeds the current balance.';
              }
            } else {
              if (value > parseFloat(this.debtsPerAsset[this.sourceAsset].debt)) {
                return 'Amount exceeds the current debt.';
              }
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
              return `Max. allowed ${this.targetAsset} amount is ${allowed.toFixed(0)}.`;
            }
          }
        }
      ];
    },

    calculateHealthAfterTransaction() {
      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);

        if (this.swapDebtMode) {
          if (symbol === this.sourceAsset) {
            borrowed -= this.sourceAssetAmount;
            balance -= this.sourceAssetAmount;
          }

          if (symbol === this.targetAsset) {
            borrowed += this.targetAssetAmount;
            balance += this.targetAssetAmount;
          }

        } else {
          if (symbol === this.sourceAsset) {
            balance -= this.sourceAssetAmount;
          }

          if (symbol === this.targetAsset) {
            balance += this.targetAssetAmount;
          }
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

      let lbTokens = Object.values(this.traderJoeV2LpAssets);

      console.log('tokens')
      console.log(tokens)

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
}

.received-amount {
  display: flex;
  font-size: 14px;
  color: var(--swap-modal__received-amount-color);
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

</style>
