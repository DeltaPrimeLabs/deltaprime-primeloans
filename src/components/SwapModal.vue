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

      <div class="modal-top-desc" v-if="swapDex === 'YakSwap' && showYakSwapWarning">
        <div>
          <b>We recommend using Paraswap for swaps of $50K+.</b>
        </div>
      </div>

      <div class="modal-top-desc" v-if="['YakSwap', 'ParaSwapV2'].includes(swapDex) && !swapDebtMode">
        <div>
          <b>Token availability might change with different aggregators.</b>
        </div>
      </div>

      <div class="modal-top-desc" v-if="info">
        <div>
          <b v-html="info"></b>
        </div>
      </div>

      <div class="asset-info" v-if="!swapDebtMode">
        Available:
        <span v-if="sourceAssetBalance && sourceAssetData" class="asset-info__value">{{
            Number(sourceAssetBalance) | smartRound(sourceAssetData.decimals, true)
          }}</span>
      </div>
      <div class="asset-info" v-if="swapDebtMode">
        Borrowed:
        <span v-if="sourceAssetDebt && sourceAssetData" class="asset-info__value">
          {{
            Number(debtsPerAsset[sourceAsset].debt) | smartRound(sourceAssetData.decimals, true)
          }}
        </span>
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
            (targetAssetData && targetAssetData.short) ? targetAssetData.short : targetAsset
          }} = {{ estimatedNeededTokens / estimatedReceivedTokens | smartRound }} {{ sourceAsset }}</span>
        </div>
      </div>

      <div class="slippage-bar" v-if="feeMethods && feeMethods[swapDex]">
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


      <div class="price-impact-option price-impact">
        <div class="label-with-separator">
          Acceptable Slippage
          <InfoIcon
            class="label__info-icon"
            :tooltip="{ content: 'Choose price impact you are willing to take. Lower values might results in failed transaction', placement: 'top', classes: 'info-tooltip' }"
          ></InfoIcon>
        </div>
        <div v-if="!advancedSlippageMode" class="price-impact-option__content">
          <div
            v-for="(option, key) in priceImpactOptions"
            class="price-impact-option-tile"
            :key="key"
            :class="[selectedPriceImpactOption === key ? 'active' : '', option.disabled ? 'disabled' : '']"
            v-on:click="() => handlePriceImpactClick(key)"
          >
            <img class="price-impact-icon" :src="option.imgSrc" />
            <div class="price-impact-label">
              {{ option.name }} {{option.value / 100 | percent}}
            </div>
          </div>
        </div>

        <div class="advanced-slippage slippage-bar slippage-bar--embedded" v-if="advancedSlippageMode">
          <span class="slippage-label">Max. acceptable slippage:</span>
          <SimpleInput :percent="true" :default-value="userSlippage" v-on:newValue="userSlippageChange"></SimpleInput>
          <span class="percent">%</span>
          <div class="slippage__divider"></div>
          <div class="dex-slippage">
            <span class="slippage-label">Price impact:</span>
            <span class="deviation-value">{{ marketDeviation }}<span class="percent">%</span></span>
            <div class="info__icon__wrapper">
              <InfoIcon
                class="info__icon"
                :tooltip="{content: 'The difference between DEX and market prices.', placement: 'top', classes: 'info-tooltip'}"
              ></InfoIcon>
            </div>
          </div>
        </div>

        <div class="label-with-separator">
          Advanced Mode
          <ToggleButton class="advanced-mode-toggle" v-on:toggleChange="advancedModeToggle()">
          </ToggleButton>
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
                {{ (sourceAssetData && sourceAssetData.short) ? sourceAssetData.short : sourceAsset }} balance:
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
                {{ (targetAssetData && targetAssetData.short) ? targetAssetData.short : targetAsset }} balance:
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
                :waiting="transactionOngoing || isTyping || calculatingSwapRoute">
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
import DeltaIcon from "./DeltaIcon.vue";
import InfoIcon from "./InfoIcon.vue";
import Toggle from './Toggle.vue';
import ToggleButton from './notifi/settings/ToggleButton.vue';

const ethers = require('ethers');

export default {
  name: 'SwapModal',
  components: {
    ToggleButton,
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
      info: null,
      userSlippage: 0.5,
      slippageMargin: null,
      queryMethod: null,
      feeMethods: null,
      lastChangedSource: true,
      sourceValidators: [],
      sourceWarnings: [],
      slippageWarning: '',
      targetValidators: [],
      customSourceValidators: null,
      customTargetValidators: null,
      sourceInputError: true,
      targetInputError: false,
      checkingPrices: false,
      isTyping: false,
      checkMarketDeviation: true, //check oracle slippage
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
      gmxV2Assets: {},
      gmxV2Balances: {},
      traderJoeV2LpAssets: {},
      balancerLpAssets: {},
      balancerLpBalances: {},
      transactionOngoing: false,
      debt: 0,
      thresholdWeightedValue: 0,
      estimatedReceivedTokens: 0,
      estimatedNeededTokens: 0,
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
      targetAssetsConfig: config.ASSETS_CONFIG,
      swapDexsConfig: config.SWAP_DEXS_CONFIG,
      reverseSwapDisabled: false,
      calculatingSwapRoute: false,
      priceImpactOptions: config.SWAP_MODAL_PRICE_IMPACT_OPTIONS,
      selectedPriceImpactOption: Object.keys(config.SWAP_MODAL_PRICE_IMPACT_OPTIONS)[0],
      advancedSlippageMode: false
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
    receivedAccordingToOracle() {
      return (this.estimatedNeededTokens && this.sourceAssetData && this.targetAssetData)
          ?
          this.estimatedNeededTokens * this.sourceAssetData.price / this.targetAssetData.price
          :
          0;
    }
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
      console.log('submit this.swapDex: ', this.swapDex)
      console.log('sourceAssetAmount: ', sourceAssetAmount)
      const sourceAssetAmount = (this.maxButtonUsed && this.swapDex !== 'ParaSwapV2' && !this.swapDebtMode) ? this.sourceAssetAmount * config.MAX_BUTTON_MULTIPLIER : this.sourceAssetAmount;
      console.log('sourceAssetAmount: ', sourceAssetAmount)
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
      console.log(dex);
      if (dex === 'ParaSwap') {
        dex = 'ParaSwapV2'
      }
      this.swapDex = dex;
      this.setupSourceAssetOptions();
      this.setupTargetAssetOptions();
      if (this.currentSourceInputChangeEvent.value) {
        this.sourceInputChange(this.currentSourceInputChangeEvent);
      }
    },

    async query(sourceAsset, targetAsset, amountIn, amountOut) {
      if (this.swapDebtMode) {
        return await this.queryMethod(targetAsset, sourceAsset, amountIn);
      } else {
        return await this.queryMethods[this.swapDex](sourceAsset, targetAsset, amountIn);
      }
    },

    async chooseBestTrade(basedOnSource = true) {
      this.calculatingSwapRoute = true;
      if (this.sourceAssetAmount == null) return;
      if (this.sourceAssetAmount === 0) {
        this.targetAssetAmount = 0;
        return;
      }

      this.lastChangedSource = true;
      let sourceDecimals = this.sourceAssetData.decimals;
      console.log(sourceDecimals);
      let sourceAmountInWei = parseUnits(this.sourceAssetAmount.toFixed(sourceDecimals), BigNumber.from(sourceDecimals));
      let targetDecimals = this.targetAssetData.decimals;
      let oracleReceivedAmountInWei = parseUnits(this.receivedAccordingToOracle.toFixed(targetDecimals), BigNumber.from(targetDecimals));

      console.log('receivedAccordingToOracle: ', this.receivedAccordingToOracle)
      console.log('estimatedNeededTokens: ', this.estimatedNeededTokens)
      const queryResponse =
          this.swapDebtMode
          ?
          await this.query(this.targetAsset, this.sourceAsset, sourceAmountInWei)
          :
          await this.query(this.sourceAsset, this.targetAsset, sourceAmountInWei);


      let estimated;
      if (queryResponse) {
        if (this.swapDebtMode) {
          console.log(queryResponse);
          estimated = queryResponse.amounts[queryResponse.amounts.length - 1];
          console.log('estimated')
          console.log(estimated);
          this.calculatingSwapRoute = false;
          const estimatedReceivedTokens = parseFloat(formatUnits(estimated, BigNumber.from(this.targetAssetData.decimals)));
          console.log(estimatedReceivedTokens);
          this.updateSlippageWithAmounts(estimatedReceivedTokens);
        } else {
          console.log('queryResponse', queryResponse);
          console.log(queryResponse instanceof BigNumber);
          this.calculatingSwapRoute = false;
          if (queryResponse.dex === 'PARA_SWAP') {
            estimated = queryResponse.amounts[queryResponse.amounts.length - 1];
            this.paraSwapRate = queryResponse.swapRate;
          } else {
            if (queryResponse instanceof BigNumber || !queryResponse.path) {
              estimated = queryResponse;
            } else {
              this.path = queryResponse.path;
              this.adapters = queryResponse.adapters;
              estimated = queryResponse.amounts[queryResponse.amounts.length - 1];
            }
          }

          let estimatedReceived = parseFloat(formatUnits(estimated, BigNumber.from(this.targetAssetData.decimals)));

          if (this.feeMethods && this.feeMethods[this.swapDex]) {
            this.fee = fromWei(await this.feeMethods[this.swapDex](this.sourceAsset, this.targetAsset, sourceAmountInWei, estimated));

            estimatedReceived -= this.fee * estimatedReceived;
          }

          this.updateSlippageWithAmounts(estimatedReceived);
        }

        this.calculateHealthAfterTransaction();
      }
    },

    async updateAmountsWithSlippage() {
      this.targetAssetAmount =
          this.swapDebtMode
          ?
          this.receivedAccordingToOracle * (1 + ((this.userSlippage + this.marketDeviation) / 100 + (this.fee ? this.fee : 0)))
          :
          this.receivedAccordingToOracle * (1 - ((this.userSlippage + this.marketDeviation) / 100 + (this.fee ? this.fee : 0)));


      const targetInputChangeEvent = await this.$refs.targetInput.setCurrencyInputValue(this.targetAssetAmount);

      this.estimatedReceivedTokens = this.targetAssetAmount;

      this.setSlippageWarning();
    },

    async updateSlippageWithAmounts(estimatedReceivedTokens) {
      let dexSlippage = 0;
      dexSlippage = (this.receivedAccordingToOracle - estimatedReceivedTokens) / estimatedReceivedTokens;


      if (this.checkMarketDeviation) {
        dexSlippage = (this.receivedAccordingToOracle - estimatedReceivedTokens) / estimatedReceivedTokens;
        this.marketDeviation = parseFloat((100 * dexSlippage).toFixed(3));
      }

      let slippageMargin = this.slippageMargin ? this.slippageMargin : config.SWAP_DEXS_CONFIG[this.swapDex].slippageMargin;

      let updatedSlippage = slippageMargin + 100 * dexSlippage;

      // this.userSlippage = parseFloat(updatedSlippage.toFixed(3));

      await this.updateAmountsWithSlippage();
    },

    setSlippageWarning() {
      // this.slippageWarning = '';
      // if (this.userSlippage > 2) {
      //   this.slippageWarning = 'Slippage exceeds 2%. Be careful.';
      // } else if (this.userSlippage < this.marketDeviation) {
      //   this.slippageWarning = 'Slippage below current DEX slippage. Transaction will likely fail.';
      // } else if (parseFloat((this.userSlippage - this.marketDeviation).toFixed(3)) < 0.01) {
      //   this.slippageWarning = 'Slippage close to current DEX slippage. Transaction can fail.';
      // }
    },

    setupSourceAssetOptions() {
      this.sourceAssetOptions = [];
      let sourceAssets;
      if (this.sourceAssets) {
        sourceAssets = this.sourceAssets;
      } else {
        sourceAssets = this.swapDexsConfig[this.swapDex].availableAssets;
      }

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

      let targetAssets;
      if (this.targetAssets) {
        targetAssets = this.targetAssets;
      } else {
        targetAssets = this.swapDexsConfig[this.swapDex].availableAssets;
      }

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
      const sourceAssetBalance = this.assetBalances[this.sourceAsset];
      this.sourceAssetBalance = sourceAssetBalance;
    },

    async delay(ms) {
      return new Promise(res => setTimeout(res, ms));
    },

    reverseSwap() {
      if (this.reverseSwapDisabled) return;
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
        // {
        // validate: async (value) => {
        //   if (this.healthAfterTransaction < this.MIN_ALLOWED_HEALTH) {
        //     return 'The health is below allowed limit.';
        //   }
        // }
        // },
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

      if (this.customTargetValidators) {
        this.targetValidators.push(...this.customTargetValidators);
      }
    },

    async handlePriceImpactClick(key) {
      console.log(key);
      if (!this.priceImpactOptions[key].disabled) {
        this.selectedPriceImpactOption = key;
        this.userSlippage = this.priceImpactOptions[key].value;

        await this.updateAmountsWithSlippage();
      }
    },

    async advancedModeToggle() {
      this.advancedSlippageMode = !this.advancedSlippageMode;
      if (this.advancedSlippageMode) {
        this.userSlippage = 0;
        await this.updateAmountsWithSlippage();
      } else {
        this.handlePriceImpactClick('low');
      }
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

          tokens.push({
            price: data.price,
            balance: balance ? balance : 0,
            borrowed: 0,
            debtCoverage: data.debtCoverage
          });
        }
      }

      for (const [symbol, data] of Object.entries(this.gmxV2Assets)) {
        let balance = parseFloat(this.gmxV2Balances[symbol]);

        if (symbol === this.sourceAsset) {
          balance -= this.sourceAssetAmount;
        }

        if (symbol === this.targetAsset) {
          balance += this.targetAssetAmount;
        }

        tokens.push({
          price: data.price,
          balance: balance,
          borrowed: 0,
          debtCoverage: data.debtCoverage
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

.price-impact-option {
  display: flex;
  flex-direction: column;
  &.price-impact {
    margin-top: 10px;
  }
  .label-with-separator {
    font-family: Montserrat;
    font-size: $font-size-sm;
    font-weight: 600;
    font-stretch: normal;
    font-style: normal;
    line-height: normal;
    letter-spacing: normal;
    text-align: left;
    color: var(--swap-modal__label-with-separator);
    display: flex;
    align-items: center;
    &:after {
      content: "";
      display: block;
      background-color: var(--swap-modal__label-with-separator-background);
      height: 2px;
      flex-grow: 1;
      margin-left: 10px;
    }
    .label__info-icon {
      margin-left: 8px;;
    }
  }
  .price-impact-option__content {
    width: 100%;
    margin: 30px 0;
    display: flex;
    justify-content: space-between;
    .price-impact-option-tile {
      width: 120px;
      height: 100px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 18px 0 6px;
      border-radius: 15px;
      border: var(--swap-modal__liquidity-shape-border);
      cursor: pointer;

      &.disabled {
        cursor: initial;
      }

      .price-impact-icon {
        margin: 0 37px;
        filter: grayscale(1);
        opacity: 0.75;
        width: 40px;
        height: 40px;
      }
      .price-impact-label {
        margin-top: 6px;
        font-family: Montserrat;
        font-size: $font-size-xsm;
        font-weight: 500;
        font-stretch: normal;
        font-style: normal;
        line-height: normal;
        letter-spacing: normal;
        text-align: left;
      }
      &.active {
        border: var(--swap-modal__liquidity-shape-border-active);
        box-shadow: var(--swap-modal__liquidity-shape-box-shadow);
        background-color: var(--swap-modal__liquidity-shape-background);
        .price-impact-icon {
          filter: grayscale(0);
          opacity: 1;
        }
        .price-impact-label {
          font-weight: 600;
        }
      }
      &:hover &:not(.disabled) {
        border-color: var(--swap-modal__liquidity-shape-border-hover);
      }
    }
  }
}

.advanced-slippage {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.advanced-mode-toggle {
  margin-left: 8px;
}


</style>
