<template>
  <div v-if="asset" id="modal" class="withdraw-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        Withdraw collateral
      </div>
      <div class="modal-top-desc" v-if="showTopDescription">
        Please make sure that every asset's 'balance' is higher than that asset's 'borrowed', in order to withdraw.
        <a target="_blank" href="https://docs.deltaprime.io/protocol/safety#withdrawal-guard"><b>Read more</b></a>
      </div>
      <div class="modal-top-info">
        <div class="top-info__label">Available:&nbsp;
          <InfoIcon v-if="isFarm" :tooltip="{content: 'Receipt token amount, can differ from `Staked` amount.', classes: 'info-tooltip long', placement: 'top'}"></InfoIcon>
        </div>
        <div class="top-info__value">
          {{assetBalance | smartRound(asset.decimals, true)}}
          <span class="top-info__currency">
            {{ asset.name }}
          </span>
        </div>
      </div>

      <CurrencyInput v-if="isLP"
                     :symbol="asset.primary"
                     :symbol-secondary="asset.secondary"
                     :asset="asset"
                     v-on:newValue="withdrawValueChange"
                     :validators="validators"
                     :info="() => sourceAssetValue">
      </CurrencyInput>
      <CurrencyInput v-else
                     :symbol="asset.short ? asset.short : asset.symbol"
                     :asset="asset"
                     v-on:newValue="withdrawValueChange"
                     :logo="logo"
                     :validators="validators"
                     :info="() => sourceAssetValue">
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after confirmation:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div>
              <div class="summary__label"
                   v-bind:class="{'summary__label--error': healthAfterTransaction < MIN_ALLOWED_HEALTH}">
                Health:
              </div>
              <div class="summary__value">
              <span class="summary__value--error" v-if="healthAfterTransaction < MIN_ALLOWED_HEALTH">
                {{ healthAfterTransaction | percent }}
              </span>
                <span v-if="healthAfterTransaction >= MIN_ALLOWED_HEALTH">
                {{ healthAfterTransaction | percent }}
              </span>
              </div>
              <BarGaugeBeta :min="0" :max="1" :value="healthAfterTransaction" :slim="true"></BarGaugeBeta>
            </div>
            <div class="summary__divider"></div>
            <div>
              <div class="summary__label">
                Balance:
              </div>
              <div class="summary__value">
                {{
                  (Number(assetBalance) - Number(withdrawValue)) > 0 ? (Number(assetBalance) - Number(withdrawValue)) : 0 | smartRound
                }}
                {{ isLP ? asset.primary + '-' + asset.secondary : asset.name }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="toggle-container" v-if="asset.name === toggleOptions[0]">
        <Toggle v-on:change="assetToggleChange" :options="toggleOptions"></Toggle>
      </div>

      <div class="button-wrapper">
        <Button :label="'Withdraw'"
                v-on:click="submit()"
                :disabled="currencyInputError"
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
import Toggle from './Toggle';
import BarGaugeBeta from './BarGaugeBeta';
import config from '../config';
import {calculateHealth} from '../utils/calculate';
import InfoIcon from "./InfoIcon.vue";

export default {
  name: 'WithdrawModal',
  components: {
    InfoIcon,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle,
  },

  props: {
    asset: {},
    health: {},
    assetBalances: {},
    assets: {},
    logo: null,
    farms: {},
    debtsPerAsset: {},
    lpAssets: {},
    lpBalances: {},
    concentratedLpAssets: {},
    concentratedLpBalances: {},
    levelLpAssets: {},
    levelLpBalances: {},
    penpieLpAssets: {},
    penpieLpBalances: {},
    traderJoeV2LpAssets: {},
    balancerLpAssets: {},
    balancerLpBalances: {},
    gmxV2Assets: {},
    gmxV2Balances: {},
    showTopDescription: true,
  },

  data() {
    return {
      withdrawValue: 0,
      healthAfterTransaction: 0,
      validators: [],
      currencyInputError: true,
      MIN_ALLOWED_HEALTH: config.MIN_ALLOWED_HEALTH,
      selectedWithdrawAsset: config.NATIVE_ASSET_TOGGLE_OPTIONS[0],
      toggleOptions: config.NATIVE_ASSET_TOGGLE_OPTIONS,
      isLP: false,
      isFarm: false,
      transactionOngoing: false,
      debt: 0,
      thresholdWeightedValue: 0,
      maxWithdraw: 0,
      valueAsset: "USDC",
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
      this.calculateHealthAfterTransaction();
      this.calculateMaxWithdraw();
    });
  },

  computed: {
    getModalHeight() {
      return this.asset.symbol === this.toggleOptions[0] ? '561px' : null;
    },

    sourceAssetValue() {
      const sourceAssetUsdPrice = Number(this.withdrawValue) * this.asset.price;
      const nativeAssetUsdPrice = config.ASSETS_CONFIG[this.toggleOptions[0]].price;

      if (this.valueAsset === "USDC") return `~ $${sourceAssetUsdPrice.toFixed(2)}`;
      // otherwise return amount in native symbol
      return `~ ${(sourceAssetUsdPrice / nativeAssetUsdPrice).toFixed(2)} ${this.toggleOptions[0]}`;
    },
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      let withdrawEvent = {};
      if (this.asset.symbol === this.toggleOptions[0]) {
        withdrawEvent = {
          withdrawAsset: this.selectedWithdrawAsset,
          value: this.withdrawValue,
        };
      } else {
        withdrawEvent = {
          withdrawAsset: this.asset.symbol,
          value: this.withdrawValue,
        };
      }

      this.$emit('WITHDRAW', withdrawEvent);
    },


    withdrawValueChange(event) {
      console.log('withdrawValueChange')
      console.log(event)
      this.withdrawValue = event.value;
      this.currencyInputError = event.error;
      this.calculateHealthAfterTransaction();
    },

    calculateHealthAfterTransaction() {
      let withdrawn = this.withdrawValue ? this.withdrawValue : 0;

      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);
        if (symbol === this.asset.symbol) {
          balance -= withdrawn;
        }

        tokens.push({ price: data.price, balance: balance, borrowed: borrowed, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.lpAssets)) {
        let balance = parseFloat(this.lpBalances[symbol]);

        if (symbol === this.asset.symbol) {
          balance -= withdrawn;
        }

        tokens.push({ price: data.price, balance: balance, borrowed: 0, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.concentratedLpAssets)) {
        let balance = parseFloat(this.concentratedLpBalances[symbol]);

        if (symbol === this.asset.symbol) {
          balance -= withdrawn;
        }

        tokens.push({ price: data.price, balance: balance, borrowed: 0, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.levelLpAssets)) {
        let balance = parseFloat(this.levelLpBalances[symbol]);

        if (symbol === this.asset.symbol) {
          balance -= withdrawn;
        }

        tokens.push({ price: data.price, balance: balance, borrowed: 0, debtCoverage: data.debtCoverage});
      }

      if (this.penpieLpAssets) {
        for (const [symbol, data] of Object.entries(this.penpieLpAssets)) {
          if (this.penpieLpBalances) {
            let balance = parseFloat(this.penpieLpBalances[symbol]);
            if (symbol === this.asset.symbol) {
              balance -= withdrawn;
            }
            tokens.push({
              price: data.price,
              balance: balance ? balance : 0,
              borrowed: 0,
              debtCoverage: data.debtCoverage
            });
          }
        }
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

      this.$forceUpdate();
    },

    assetToggleChange(asset) {
      this.selectedWithdrawAsset = asset;
    },

    setupValidators() {
      this.validators = [
        // {
        //   validate: (value) => {
        //     if (this.healthAfterTransaction <= 0) {
        //       return `Health should be higher than 0%`;
        //     }
        //   }
        // },
        {
          validate: (value) => {
            if (this.assetBalance - value < 0) {
              console.log('validate')
              console.log('this.assetBalance: ', this.assetBalance)
              console.log('value: ', value)
              return `Withdraw amount exceeds balance`;
            }
          }
        },
        {
          validate: (value) => {
            let canRepayAllDebts = Object.values(this.debtsPerAsset).every(
                debt => {
                  let balance = parseFloat(this.assetBalances[debt.asset]);
                  if (debt.asset === this.asset.symbol) {
                    balance -= value;
                  }
                  return parseFloat(debt.debt) <= balance;
                }
            );

            if (!canRepayAllDebts) {
              return 'Not all \'borrowed\' is covered by its \'balance\'. Update missing balance(s) to withdraw. <a target="_blank" style="color: var(--currency-input__error-color)" href="https://docs.deltaprime.io/protocol/security/withdrawal-guard">Read more</a>.'
            }
          }
        }
      ];
    },

    calculateMaxWithdraw() {
      //TODO: we should check it and use correct formula
      // const MIN_HEALTH = 0.0182;
      // const numerator = -this.debt + this.thresholdWeightedValue - MIN_HEALTH;
      // const denominator = this.asset.price - (this.asset.price * this.asset.debtCoverage) + (MIN_HEALTH * this.asset.price * this.asset.debtCoverage);
      // const maxWithdrawLimitedByHealth = numerator / denominator;
      // this.maxWithdraw = Math.min(maxWithdrawLimitedByHealth, this.assetBalance);
      this.maxWithdraw = this.assetBalance;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

</style>
