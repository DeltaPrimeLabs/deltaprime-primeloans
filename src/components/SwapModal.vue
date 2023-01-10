<template>
  <div id="modal" class="swap-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Swap
      </div>
      <CurrencyComboInput ref="sourceInput"
                          :asset-options="sourceAssetOptions"
                          v-on:valueChange="sourceInputChange"
                          :validators="sourceValidators"">
      </CurrencyComboInput>
      <div class="asset-info">
        Available:
        <span v-if="sourceAssetBalance" class="asset-info__value">{{ Number(sourceAssetBalance) | smartRound }}</span>
      </div>

      <div class="reverse-swap-button">
        <img src="src/assets/icons/swap-arrow.svg" class="reverse-swap-icon" v-on:click="reverseSwap">
      </div>

      <CurrencyComboInput ref="targetInput"
                          :asset-options="targetAssetOptions"
                          :info="slippageInfo"
                          v-on:valueChange="targetInputChange">
      </CurrencyComboInput>
      <div class="asset-info">
        Price: <span
        class="asset-info__value">1 {{ targetAsset }} = {{ conversionRate | smartRound }} {{ sourceAsset }}</span>
      </div>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
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
                {{ sourceAsset }} balance:
              </div>
              <div class="summary__value">
                {{
                  formatTokenBalance(Number(assetBalances[sourceAsset]) - Number(sourceAssetAmount)) > 0 ? formatTokenBalance(Number(assetBalances[sourceAsset]) - Number(sourceAssetAmount)) : 0
                }}
              </div>
            </div>

            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                {{ targetAsset }} balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(Number(assetBalances[targetAsset]) + Number(targetAssetAmount)) }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Swap'"
                v-on:click="submit()"
                :disabled="sourceInputError || targetInputError"
                :waiting="transactionOngoing">
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
import {BigNumber, Contract} from "ethers";
import INTERMEDIARY from '@artifacts/contracts/integrations/UniswapV2Intermediary.sol/UniswapV2Intermediary.json';
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';

const MIN_ACCEPTABLE_SLIPPAGE = 0.03;
export default {
  name: 'SwapModal',
  components: {
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
      sourceAssetOptions: [],
      targetAssetOptions: [],
      sourceAsset: null,
      targetAsset: null,
      sourceAssetBalance: 0,
      targetAssetBalance: null,
      conversionRate: null,
      sourceAssetAmount: 0,
      targetAssetAmount: 0,
      sourceValidators: [],
      targetValidators: [],
      sourceInputError: true,
      targetInputError: false,
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
      chosenDex: config.DEX_CONFIG[0],
      estimatedReceivedTokens: 0
    };
  },

  mounted() {
    this.setupSourceAssetOptions();
    this.setupTargetAssetOptions();
    setTimeout(() => {
      this.setupSourceAsset();
      this.setupTargetAsset();
      this.setupConversionRate();
      this.setupValidators();
      this.calculateHealthAfterTransaction();
    });
  },

  computed: {
    slippage() {
      return this.estimatedReceivedTokens ? Math.max(0, (this.targetAssetAmount - this.estimatedReceivedTokens) / this.targetAssetAmount) : 0;
    },
    slippageInfo() {
      return () =>
          `Current slippage ${(this.slippage * 100).toFixed(2)}%, maximum ${((this.slippage + MIN_ACCEPTABLE_SLIPPAGE) * 100).toFixed(2)}%`;
    },
    minTargetAssetAmount() {
      return this.targetAssetAmount * (1 - (this.slippage + MIN_ACCEPTABLE_SLIPPAGE));
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      this.$emit('SWAP', {
        sourceAsset: this.sourceAsset,
        targetAsset: this.targetAsset,
        sourceAmount: this.sourceAssetAmount,
        targetAmount: this.minTargetAssetAmount,
        chosenDex: this.chosenDex
      });
    },

    async chooseBestTrade() {
      if (!this.sourceAssetAmount) return;

      let estimatedReceivedTokens = 0;
      let chosenDex = 'Pangolin';

      for (let dex in config.DEX_CONFIG) {
        const intermediaryContract = new Contract(config.DEX_CONFIG[dex].intermediaryAddress, INTERMEDIARY.abi, provider.getSigner());

        const whitelistedTokens = await intermediaryContract.getAllWhitelistedTokens();
        const whiteListedTokensUppercase = whitelistedTokens.map(address => address.toUpperCase());
        const isSourceAssetWhiteListed = whiteListedTokensUppercase.includes(TOKEN_ADDRESSES[this.sourceAsset].toUpperCase());
        const isTargetAssetWhiteListed = whiteListedTokensUppercase.includes(TOKEN_ADDRESSES[this.targetAsset].toUpperCase());
        const areWhitelisted = isSourceAssetWhiteListed && isTargetAssetWhiteListed;

        if (areWhitelisted) {
          let receivedAmount = await intermediaryContract.getMaximumTokensReceived(parseUnits(this.sourceAssetAmount.toString(), BigNumber.from(config.ASSETS_CONFIG[this.sourceAsset].decimals)), TOKEN_ADDRESSES[this.sourceAsset], TOKEN_ADDRESSES[this.targetAsset]);

          if (receivedAmount.gt(estimatedReceivedTokens)) {
            estimatedReceivedTokens = receivedAmount;
            chosenDex = dex;
          }
        }
      }

      this.chosenDex = chosenDex;
      this.estimatedReceivedTokens = parseFloat(formatUnits(estimatedReceivedTokens, BigNumber.from(config.ASSETS_CONFIG[this.targetAsset].decimals)));
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

    async sourceInputChange(changeEvent) {
      let targetInputChangeEvent;
      if (changeEvent.asset === this.targetAsset) {
        this.reverseSwap();
      } else {
        this.sourceAsset = changeEvent.asset;
        const targetAssetAmount = changeEvent.value / this.conversionRate;
        if (!Number.isNaN(targetAssetAmount)) {
          const value = Math.ceil(targetAssetAmount * 1000000) / 1000000;
          this.sourceAssetAmount = changeEvent.value;
          this.targetAssetAmount = value;
          targetInputChangeEvent = await this.$refs.targetInput.setCurrencyInputValue(value);
          this.calculateSourceAssetBalance();
          this.setupConversionRate();
          await this.chooseBestTrade();
          this.calculateHealthAfterTransaction();
        }
      }
      this.sourceInputError = changeEvent.error;
      if (targetInputChangeEvent) {
        this.targetInputError = targetInputChangeEvent.error;
      }
    },

    async targetInputChange(changeEvent) {
      let sourceInputChangeEvent;
      if (changeEvent.asset === this.sourceAsset) {
        this.reverseSwap();
      } else {
        this.targetAsset = changeEvent.asset;
        const sourceAssetAmount = changeEvent.value * this.conversionRate;
        if (!Number.isNaN(sourceAssetAmount)) {
          const value = Math.ceil(sourceAssetAmount * 1000000) / 1000000;
          this.targetAssetAmount = changeEvent.value;
          this.sourceAssetAmount = value;
          sourceInputChangeEvent = await this.$refs.sourceInput.setCurrencyInputValue(value);
          this.calculateSourceAssetBalance();
          this.setupConversionRate();
          await this.chooseBestTrade();
          this.calculateHealthAfterTransaction();
        }
      }
      this.targetInputError = changeEvent.error;
      if (sourceInputChangeEvent) {
        this.sourceInputError = sourceInputChangeEvent.error;
      }
    },

    setupConversionRate() {
      const sourceAsset = config.ASSETS_CONFIG[this.sourceAsset];
      const targetAsset = config.ASSETS_CONFIG[this.targetAsset];
      this.conversionRate = targetAsset.price / sourceAsset.price;
    },

    calculateSourceAssetBalance() {
      const sourceAssetBalance = this.assetBalances[this.sourceAsset];
      this.sourceAssetBalance = sourceAssetBalance;
    },

    reverseSwap() {
      const tempSource = this.sourceAsset;
      this.sourceAsset = this.targetAsset;
      this.targetAsset = tempSource;

      this.setupSourceAsset();
      this.setupTargetAsset();

      this.calculateSourceAssetBalance();
      this.setupConversionRate();

      this.calculateHealthAfterTransaction();
    },

    setupValidators() {
      this.sourceValidators = [
        {
          validate: (value) => {
            if (value > this.assetBalances[this.sourceAsset]) {
              return 'Amount exceeds balance';
            }
          }
        },
        {
          validate: async (value) => {
            await this.chooseBestTrade();
            setTimeout(() => {
              this.calculateHealthAfterTransaction(value);
            })
            if (this.healthAfterTransaction < this.MIN_ALLOWED_HEALTH) {
              return 'The health is below allowed limit';
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

        if (symbol === this.sourceAsset) {
          balance -= this.sourceAssetAmount;
        }

        if (symbol === this.targetAsset) {
          balance += this.minTargetAssetAmount;
        }

        tokens.push({ price: data.price, balance: balance, borrowed: borrowed, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.lpAssets)) {
        tokens.push({ price: data.price, balance: parseFloat(this.lpBalances[symbol]), borrowed: 0, debtCoverage: data.debtCoverage});
      }

      for (const [, farms] of Object.entries(this.farms)) {
        farms.forEach(farm => {
          tokens.push({
            price: farm.price,
            balance: parseFloat(farm.totalStaked),
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

.bar-gauge-tall-wrapper {
  padding-top: 5px;
}

</style>