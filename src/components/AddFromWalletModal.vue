<template>
  <div v-if="asset" id="modal" class="add-from-wallet-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        Add collateral
      </div>
      <div class="modal-top-info" v-if="noSmartLoan">This transaction will deploy your Prime Account and load your
        funds.<br/>
        When it's done, you can explore the power of undercollateralized loans.
      </div>
      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value" v-bind:class="{'available-balance--loading': !getAvailableAssetAmount && getAvailableAssetAmount !== 0}">
          <LoadedValue :check="() => getAvailableAssetAmount != null || Number.isNaN(getAvailableAssetAmount)"
                       :value="isLP ? formatTokenBalance(getAvailableAssetAmount, 10, true) : formatTokenBalance(getAvailableAssetAmount)"></LoadedValue>
          <div v-if="getAvailableAssetAmount != null">
            <span v-if="asset.name === 'AVAX'" class="top-info__currency">
              {{ selectedDepositAsset }}
            </span>
            <span v-if="asset.name !== 'AVAX'" class="top-info__currency">
              {{ isLP ? asset.name : asset.symbol }}
            </span>
          </div>
        </div>
      </div>

      <CurrencyInput ref="lpCurrencyInput"
                     v-if="isLP"
                     :symbol="asset.primary"
                     :symbol-secondary="asset.secondary"
                     v-on:newValue="inputChange"
                     :validators="validators"
                     :max="getAvailableAssetAmount">
      </CurrencyInput>
      <CurrencyInput ref="currencyInput"
                     v-if="!isLP"
                     :symbol="asset.symbol"
                     v-on:newValue="inputChange"
                     :validators="validators"
                     :max="getAvailableAssetAmount">
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__values">
            <div class="summary__label">
              Health Ratio:
            </div>
            <div class="summary__value">
              {{ healthAfterTransaction | percent }}
            </div>
            <BarGaugeBeta :min="0" :max="1" :value="healthAfterTransaction ? healthAfterTransaction : 0"
                          :slim="true"></BarGaugeBeta>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Balance:
            </div>
            <div class="summary__value">
              {{ (Number(assetBalance) + Number(value)) | smartRound }}
              {{ isLP ? asset.primary + '-' + asset.secondary : asset.symbol }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="toggle-container" v-if="asset.symbol === 'AVAX'">
        <Toggle v-on:change="assetToggleChange" :options="['AVAX', 'WAVAX']"></Toggle>
      </div>

      <div class="button-wrapper">
        <Button :label="'Add funds'"
                v-on:click="submit()"
                :disabled="validationError || (!getAvailableAssetAmount && getAvailableAssetAmount !== 0)"
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
import {mapState} from 'vuex';
import {calculateHealth} from '../utils/calculate';
import LoadedValue from './LoadedValue';


export default {
  name: 'AddFromWalletModal',
  components: {
    LoadedValue,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle
  },

  props: {
    asset: {},
    assets: {},
    assetBalances: {},
    debtsPerAsset: {},
    lpAssets: {},
    lpBalances: {},
    farms: {},
    thresholdWeightedValue: Number,
    loan: Number,
    assetBalance: Number,
    isLP: false,
    walletAssetBalance: {},
    walletNativeTokenBalance: {
      default: null,
    },
    noSmartLoan: false,
    transactionOngoing: false
  },

  data() {
    return {
      value: 0,
      healthAfterTransaction: 0,
      validators: [],
      selectedDepositAsset: 'AVAX',
      validationError: false,
      availableAssetAmount: 0,
    };
  },

  mounted() {
    setTimeout(() => {
      this.calculateHealthAfterTransaction();
      this.setupValidators();
    });
    setTimeout(() => {
      this.setupAvailableAssetAmount();
    }, 1);
  },

  computed: {
    ...mapState('network', ['account', 'accountBalance']),
    getModalHeight() {
      return this.asset.symbol === 'AVAX' ? '561px' : null;
    },

    getAvailableAssetAmount() {
      this.$forceUpdate();
      if (this.asset.symbol === 'AVAX') {
        if (this.selectedDepositAsset === 'AVAX') {
          return this.walletNativeTokenBalance;
        } else {
          return (!this.walletAssetBalance && this.walletAssetBalance !== 0) ? null : Number(this.walletAssetBalance);
        }
      } else {
        return (!this.walletAssetBalance && this.walletAssetBalance !== 0) ? null : Number(this.walletAssetBalance);
      }
    },
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      if (this.asset.symbol === 'AVAX') {
        this.$emit('ADD_FROM_WALLET', {value: this.value, asset: this.selectedDepositAsset});
      } else {
        this.$emit('ADD_FROM_WALLET', {value: this.value, asset: this.asset});
      }
    },

    inputChange(changeEvent) {
      this.value = changeEvent.value;
      this.validationError = changeEvent.error;
      this.calculateHealthAfterTransaction();
    },

    calculateHealthAfterTransaction() {
      if (this.noSmartLoan) this.healthAfterTransaction = 1;

      let added = this.value ? this.value : 0;

      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = (this.debtsPerAsset && this.debtsPerAsset[symbol]) ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);
        if (symbol === this.asset.symbol) {
          balance += added;
        }

        tokens.push({ price: data.price, balance: balance, borrowed: borrowed, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.lpAssets)) {
        let balance = parseFloat(this.lpBalances[symbol]);

        if (symbol === this.asset.symbol) {
          balance += added;
        }

        tokens.push({ price: data.price, balance: balance, borrowed: 0, debtCoverage: data.debtCoverage});
      }

      for (const [, farms] of Object.entries(this.farms)) {
        farms.forEach(farm => {
          tokens.push({
            price: farm.price,
            balance: parseFloat(farm.staked),
            borrowed: 0,
            debtCoverage: farm.debtCoverage
          });
        });
      }

      this.healthAfterTransaction = calculateHealth(tokens);
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.getAvailableAssetAmount) {
              return 'Exceeds account balance';
            }
          }
        }
      ];
    },

    async assetToggleChange(asset) {
      this.selectedDepositAsset = asset;
      const error = await this.$refs.currencyInput.forceValidationCheck(this.value);
      this.validationError = error !== '';
    },

    setupAvailableAssetAmount() {
      if (this.asset.symbol === 'AVAX') {
        const balance = this.selectedDepositAsset === 'AVAX' ? this.walletNativeTokenBalance : this.walletAssetBalance;
        this.availableAssetAmount = Number(balance);
      } else {
        this.availableAssetAmount = this.walletAssetBalance ? Number(this.walletAssetBalance) : null;
      }
      this.$forceUpdate();
    },

    setWalletNativeTokenBalance(balance) {
      this.walletNativeTokenBalance = balance;
      this.$forceUpdate();
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";


</style>

<style lang="scss">
.available-balance--loading {
  .loaded-value-component {
    height: 20px;
    display: flex;
    flex-direction: row;
    margin: -10px 0 -10px -10px;
  }
}
</style>