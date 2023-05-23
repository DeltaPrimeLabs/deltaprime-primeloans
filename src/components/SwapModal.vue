<template>
  <div id="modal" class="swap-modal-component modal-component">
    <Modal>
      <div class="modal__title" v-if="!swapDebtMode">
        Swap
      </div>
      <div class="modal__title" v-if="swapDebtMode">
        Swap debt
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
                          :max="swapDebtMode ? sourceAssetDebt : sourceAssetBalance"
                          :info="() => sourceAssetValue"
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
                          :info="() => targetAssetValue"
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
        DEX slippage: <span class="deviation-value">{{ marketDeviation }}<span class="percent">%</span></span>
        <div class="info__icon__wrapper">
          <InfoIcon
              class="info__icon"
              :tooltip="{content: 'The difference between DEX and market prices.', placement: 'top', classes: 'info-tooltip'}"
          ></InfoIcon>
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
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import DeltaIcon from "./DeltaIcon.vue";
import InfoIcon from "./InfoIcon.vue";

const ethers = require('ethers');

export default {
  name: 'SwapModal',
  components: {
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
      userSlippage: 0,
      queryMethod: null,
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
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupSourceAssetOptions();
      this.setupTargetAssetOptions();
      this.setupSourceAsset();
      this.setupTargetAsset();
      this.setupValidators();
      this.setupWarnings();
      this.calculateHealthAfterTransaction();
    });
  },

  computed: {
    sourceAssetValue() {
      const sourceAssetUsdPrice = Number(this.sourceAssetAmount) * this.sourceAssetData.price;
      const avaxUsdPrice = config.ASSETS_CONFIG["AVAX"].price;

      if (this.valueAsset === "USDC") return `~ $${sourceAssetUsdPrice.toFixed(2)}`;
      // otherwise return amount in AVAX 
      return `~ ${(sourceAssetUsdPrice / avaxUsdPrice).toFixed(2)} AVAX`;
    },

    targetAssetValue() {
      const targetAssetUsdPrice = Number(this.targetAssetAmount) * this.targetAssetData.price;
      const avaxUsdPrice = config.ASSETS_CONFIG["AVAX"].price;

      if (this.valueAsset === "USDC") return `~ $${targetAssetUsdPrice.toFixed(2)}`;
      // otherwise return amount in AVAX 
      return `~ ${(targetAssetUsdPrice / avaxUsdPrice).toFixed(2)} AVAX`;
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const sourceAssetAmount = this.maxButtonUsed ? this.sourceAssetAmount * config.MAX_BUTTON_MULTIPLIER : this.sourceAssetAmount;
      this.$emit('SWAP', {
        sourceAsset: this.sourceAsset,
        targetAsset: this.targetAsset,
        sourceAmount: sourceAssetAmount,
        targetAmount: this.targetAssetAmount,
        path: this.path,
        adapters: this.adapters
      });
    },

    async query(sourceAsset, targetAsset, amountIn) {
      if (this.swapDebtMode) {
        return await this.queryMethod(sourceAsset, targetAsset, amountIn);
      } else {
        return await this.queryMethod(sourceAsset, targetAsset, amountIn);
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
        if (queryResponse instanceof BigNumber) {
          estimated = queryResponse;
        } else {
          this.path = queryResponse.path;
          this.adapters = queryResponse.adapters;
          estimated = queryResponse.amounts[queryResponse.amounts.length - 1];
        }

        this.estimatedReceivedTokens = parseFloat(formatUnits(estimated, BigNumber.from(this.targetAssetData.decimals)));

        this.updateSlippageWithAmounts();
        this.calculateHealthAfterTransaction();
      }
    },

    async updateAmountsWithSlippage() {
      if (!this.swapDebtMode) {
        this.targetAssetAmount = this.receivedAccordingToOracle * (1 - this.userSlippage / 100);
      } else {
        this.targetAssetAmount = this.receivedAccordingToOracle * (1 + this.userSlippage / 100);
      }
      const targetInputChangeEvent = await this.$refs.targetInput.setCurrencyInputValue(this.targetAssetAmount);
      this.setSlippageWarning();
    },

    async updateSlippageWithAmounts() {
      let dexSlippage = 0;
      this.receivedAccordingToOracle = this.estimatedNeededTokens * this.sourceAssetData.price / this.targetAssetData.price;
      dexSlippage = (this.receivedAccordingToOracle - this.estimatedReceivedTokens) / this.estimatedReceivedTokens;

      const SLIPPAGE_MARGIN = this.swapDebtMode ? 0.2 : 0.1;
      this.marketDeviation = parseFloat((100 * dexSlippage).toFixed(3));

      let updatedSlippage = SLIPPAGE_MARGIN + 100 * dexSlippage;

      this.userSlippage = parseFloat(updatedSlippage.toFixed(3));

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
      this.sourceAssets.forEach(assetSymbol => {
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
      this.targetAssetOptions = [];
      this.targetAssets.forEach(assetSymbol => {
        const asset = config.ASSETS_CONFIG[assetSymbol];
        const assetOption = {
          symbol: assetSymbol,
          name: asset.name,
          logo: `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
        };
        this.targetAssetOptions.push(assetOption);
      });

      this.targetAssetOptions = this.targetAssetOptions.filter(option => option.symbol !== this.sourceAsset);
    },

    setupSourceAsset() {
      this.sourceAssetData = config.ASSETS_CONFIG[this.sourceAsset];
    },

    setupTargetAsset() {
      if (this.targetAsset) {
        this.targetAssetData = config.ASSETS_CONFIG[this.targetAsset];
      }
    },

    async sourceInputChange(changeEvent) {
      this.maxButtonUsed = changeEvent.maxButtonUsed;
      this.checkingPrices = true;
      let targetInputChangeEvent;
      if (changeEvent.asset === this.targetAsset) {
        this.reverseSwap();
      } else {
        if (this.sourceAsset !== changeEvent.asset) {
          this.sourceAsset = changeEvent.asset;
          this.calculateSourceAssetBalance();
          this.sourceAssetData = config.ASSETS_CONFIG[this.sourceAsset];
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
          this.targetAssetData = config.ASSETS_CONFIG[this.targetAsset];
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
      const sourceAssetBalance = this.assetBalances[this.sourceAsset];
      this.sourceAssetBalance = sourceAssetBalance;
    },

    async delay(ms) {
      return new Promise(res => setTimeout(res, ms));
    },

    reverseSwap() {
      const tempSource = this.sourceAsset;
      this.sourceAssetData = config.ASSETS_CONFIG[this.targetAsset];
      this.targetAssetData = config.ASSETS_CONFIG[this.sourceAsset];
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
          }
        },
      ];
      this.targetValidators = [
        {
          validate: async (value) => {
            if (this.healthAfterTransaction < this.MIN_ALLOWED_HEALTH) {
              return 'The health is below allowed limit.';
            }
          }
        },
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

.slippage-bar {
  border-top: var(--swap-modal__slippage-bar-border);
  border-bottom: var(--swap-modal__slippage-bar-border);
  margin-top: 26px;
  height: 42px;
  font-family: Montserrat;
  font-size: 16px;
  color: var(--swap-modal__slippage-bar-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-left: 15px;
  padding-right: 15px;

  .info__icon {
    transform: translateY(-1px);
  }

  .percent {
    font-weight: 600;
  }

  .slippage-info {
    display: flex;
    align-items: center;

    .percent {
      margin-left: 6px;
    }

    .slippage-label {
      margin-right: 6px;
    }
  }

  .deviation-value {
    font-weight: 600;
  }

  .slippage__divider {
    width: 2px;
    height: 17px;
    background-color: var(--swap-modal__slippage-divider-color);
    margin: 0 10px;
  }
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

</style>
