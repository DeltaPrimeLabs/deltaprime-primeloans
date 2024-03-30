<template>
  <div id="modal" class="mint-cai-modal-component modal-component">
    <Modal>
      <div v-if="mintMode" class="modal__title">
        Mint CAI
      </div>

      <div v-if="!mintMode" class="modal__title">
        Burn CAI
      </div>

      <div class="modal-top-desc">
        Minting/burning CAI can result in a high slippage. <br> If that's the case, please use swap function instead.
      </div>

      <div class="asset-info">
        Available:
        <span v-if="sourceAssetBalance && sourceAssetData" class="asset-info__value">{{
            Number(sourceAssetBalance) | smartRound(sourceAssetData.decimals, true)
          }}</span>
      </div>
      <CurrencyComboInput v-if="sourceAssetOptions"
                          ref="sourceInput"
                          name="sourceInput"
                          :asset-options="sourceAssetOptions"
                          :default-asset="sourceAsset"
                          :validators="sourceValidators"
                          :disabled="checkingPrices"
                          :typingTimeout="2000"
                          v-on:valueChange="sourceInputChange"
                          v-on:ongoingTyping="ongoingTyping"
      >
      </CurrencyComboInput>

      <div class="reverse-swap-button">
        <DeltaIcon class="reverse-swap-icon" :size="22" :icon-src="'src/assets/icons/swap-arrow.svg'"></DeltaIcon>
      </div>

      <CurrencyComboInput v-if="targetAssetOptions"
                          ref="targetInput"
                          name="targetInput"
                          :asset-options="targetAssetOptions"
                          :default-asset="targetAsset"
                          v-on:valueChange="targetInputChange"
                          :disabled="true"
                          info-icon-message="Minimum received amount"
                          :validators="targetValidators">
      </CurrencyComboInput>

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
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                {{ sourceAsset }} Balance:
              </div>
              <div class="summary__value">
                {{ assetBalances[sourceAsset] - sourceAmount | smartRound(6, true) }}
              </div>
            </div>
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                {{ targetAsset }} Balance:
              </div>
              <div class="summary__value">
                {{ Number(assetBalances[targetAsset]) + Number(calculatedTargetAmount) | smartRound(6, true) }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="mintMode ? 'Mint' : 'Burn'" v-on:click="submit()" :disabled="calculatingValues || sourceInputError"
                :waiting="calculatingValues || transactionOngoing"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import CurrencyInput from './CurrencyInput';
import Button from './Button';
import BarGaugeBeta from './BarGaugeBeta';
import config from '../config';
import {calculateHealth, parseUnits} from '../utils/calculate';
import CurrencyComboInput from './CurrencyComboInput.vue';
import DeltaIcon from './DeltaIcon.vue';
import {getBurnData, getMintData} from '../utils/caiUtils';
import SimpleInput from './SimpleInput.vue';
import InfoIcon from './InfoIcon.vue';

let TOKEN_ADDRESSES;

export default {
  name: 'MintCAIModal',
  components: {
    InfoIcon, SimpleInput,
    DeltaIcon,
    CurrencyComboInput,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {
    mintMode: {
      type: Boolean,
      default: true
    },
    sourceAssets: {},
    targetAssets: {},
    sourceAsset: {},
    targetAsset: {},
    assets: {},
    assetBalances: {},
    debtsPerAsset: {},
    lpAssets: {},
    lpBalances: {},
    concentratedLpAssets: {},
    concentratedLpBalances: {},
    levelLpAssets: {},
    levelLpBalances: {},
    balancerLpAssets: {},
    balancerLpBalances: {},
    gmxV2Assets: {},
    gmxV2Balances: {},
    farms: {},
    traderJoeV2LpAssets: {},
  },

  data() {
    return {
      sourceAssetOptions: [],
      targetAssetOptions: [],
      healthAfterTransaction: 0,
      MIN_ALLOWED_HEALTH: config.MIN_ALLOWED_HEALTH,
      currencyInputError: true,
      transactionOngoing: false,
      sourceValidators: [],
      targetValidators: [],
      checkingPrices: false,
      ongoingTyping: false,
      sourceAssetsConfig: config.ASSETS_CONFIG,
      targetAssetsConfig: config.ASSETS_CONFIG,
      sourceAssetData: null,
      sourceAssetBalance: 0,
      smartLoanContractAddress: null,
      mintData: null,
      burnData: null,
      sourceAmount: null,
      userSlippage: 2,
      customSlippage: 1,
      currentSourceInputChangeEvent: null,
      calculatedTargetAmount: 0,
      calculatingValues: false,
      sourceInputError: false,
    };
  },

  async mounted() {
    TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    setTimeout(() => {
      this.setupSourceAssetOptions();
      this.setupTargetAssetOptions();
      this.calculateHealthAfterTransaction();
      this.setupValidators();
      this.setupSourceAsset();
      this.calculateSourceAssetBalance(this.sourceAsset);
      this.setupValidators();
    });
  },

  computed: {},

  methods: {
    submit() {
      this.transactionOngoing = true;
      if (this.mintMode) {
        this.$emit('MINT_CAI', {
            mintData: this.mintData,
            asset: this.mintSourceAsset,
            amount: this.sourceAmount,
            calculatedTargetAmount: this.calculatedTargetAmount
          }
        );
      } else {
        this.$emit('BURN_CAI', {
            burnData: this.burnData,
            asset: this.targetAsset,
            amount: this.sourceAmount,
            calculatedTargetAmount: this.calculatedTargetAmount
          }
        );
      }
    },

    sourceInputChange(inputChangeEvent) {
      console.log(inputChangeEvent);
      this.currentSourceInputChangeEvent = inputChangeEvent;
      this.sourceInputError = inputChangeEvent.error;
      this.sourceAsset = inputChangeEvent.asset;
      this.calculateSourceAssetBalance(inputChangeEvent.asset);
      if (this.mintMode) {
        this.calculateMintTargetAmount();
      } else {
        this.calculateBurnTargetAmount();
      }
    },

    targetInputChange(value) {
      console.log(value);
      this.targetAsset = value.asset;
    },

    calculateHealthAfterTransaction() {

      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);

        if (symbol === this.targetAsset) {
          console.log(symbol);
          balance += parseFloat(this.calculatedTargetAmount);
          console.log(balance);
        }

        if (symbol === this.sourceAsset) {
          console.log(symbol);
          balance -= parseFloat(this.currentSourceInputChangeEvent ? this.currentSourceInputChangeEvent.value : 0);
          console.log(balance);
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

          tokens.push({
            price: data.price,
            balance: balance ? balance : 0,
            borrowed: 0,
            debtCoverage: data.debtCoverage
          });
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

    setupValidators() {
      this.sourceValidators = [
        {
          validate: (value) => {
            if (this.healthAfterTransaction < this.MIN_ALLOWED_HEALTH) {
              return `Health should be higher than 0%`;
            }
          },
        },
        {
          validate: (value) => {
            if (this.sourceAssetBalance < value) {
              return `Not enough balance`;
            }
          },
        },
      ];
    },

    setupSourceAssetOptions() {
      console.log('setupSourceAssetOptions');
      console.log('this.sourceAssets', this.sourceAssets);
      this.sourceAssetOptions = [];

      this.sourceAssets.forEach(assetSymbol => {
        const asset = this.sourceAssetsConfig[assetSymbol];
        const assetOption = {
          symbol: assetSymbol,
          short: asset.short,
          name: asset.name,
          logo: `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
        };
        console.log('sourceAssetOptions');
        this.sourceAssetOptions.push(assetOption);
        console.log(this.sourceAssetOptions);
      });
    },

    setupTargetAssetOptions() {
      this.targetAssetOptions = [];

      this.targetAssets.forEach(assetSymbol => {
        const asset = this.targetAssetsConfig[assetSymbol];
        const assetOption = {
          symbol: assetSymbol,
          short: asset.short,
          name: asset.name,
          logo: `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
        };
        this.targetAssetOptions.push(assetOption);
        console.log('targetAssetOptions');
        console.log(this.targetAssetOptions);
      });
    },

    setupSourceAsset() {
      this.sourceAssetData = this.sourceAssetsConfig[this.sourceAsset];
    },

    calculateSourceAssetBalance(asset) {
      console.log(this.assetBalances);
      console.log(this.sourceAssetBalance);
      this.sourceAssetBalance = this.assetBalances[asset];
    },

    async calculateMintTargetAmount() {
      this.calculatingValues = true;
      console.log('this.currentSourceInputChangeEvent', this.currentSourceInputChangeEvent);
      console.log('this.customSlippage', this.customSlippage);
      const priceCAI = config.ASSETS_CONFIG['CAI'].price;
      const sourceAssetPrice = config.ASSETS_CONFIG[this.currentSourceInputChangeEvent.asset].price;
      console.log(priceCAI);
      console.log(this.currentSourceInputChangeEvent);
      const sourceAssetDecimals = this.sourceAssetData.decimals;
      console.log(sourceAssetDecimals);
      const mintData = await getMintData(TOKEN_ADDRESSES[this.sourceAsset], parseUnits(String(this.currentSourceInputChangeEvent.value), sourceAssetDecimals), this.smartLoanContractAddress);
      console.log(mintData);
      this.mintData = mintData;
      this.sourceAmount = this.currentSourceInputChangeEvent.value;
      this.mintSourceAsset = this.currentSourceInputChangeEvent.asset;

      const calculatedTargetAmount = (this.sourceAmount * sourceAssetPrice * (1 - this.customSlippage / 100)) / priceCAI;
      console.log('calculatedTargetAmount', calculatedTargetAmount);

      this.$refs.targetInput.setCurrencyInputValue(calculatedTargetAmount);
      this.calculatedTargetAmount = calculatedTargetAmount;
      this.calculateHealthAfterTransaction();
      this.calculatingValues = false;
    },

    async calculateBurnTargetAmount() {
      this.calculatingValues = true;
      console.log('this.currentSourceInputChangeEvent', this.currentSourceInputChangeEvent);
      console.log('this.customSlippage', this.customSlippage);
      const priceCAI = config.ASSETS_CONFIG['CAI'].price;
      const targetAssetPrice = config.ASSETS_CONFIG[this.targetAsset].price;
      console.log(priceCAI);
      console.log(this.currentSourceInputChangeEvent);
      const sourceAssetDecimals = this.sourceAssetData.decimals;
      console.log(sourceAssetDecimals);
      const burnData = await getBurnData(
        parseUnits(this.currentSourceInputChangeEvent.value.toFixed(sourceAssetDecimals), sourceAssetDecimals),
        TOKEN_ADDRESSES[this.targetAsset],
        this.smartLoanContractAddress
      );
      console.log(burnData);
      this.burnData = burnData;
      this.sourceAmount = this.currentSourceInputChangeEvent.value;

      const calculatedTargetAmount = (this.sourceAmount * priceCAI * (1 - this.customSlippage / 100)) / targetAssetPrice;
      console.log('calculatedTargetAmount', calculatedTargetAmount);

      this.$refs.targetInput.setCurrencyInputValue(calculatedTargetAmount);
      this.calculatedTargetAmount = calculatedTargetAmount;
      this.calculateHealthAfterTransaction();
      this.calculatingValues = false;
    },

    userSlippageChange(slippageChange) {
      console.log('user slippage change');
      this.customSlippage = slippageChange.value;
      if (this.mintMode) {
        this.calculateMintTargetAmount();
      } else {
        this.calculateBurnTargetAmount();
      }
    }

  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.mint-cai-modal-component {
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

</style>