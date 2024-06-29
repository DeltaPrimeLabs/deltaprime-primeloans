<template>
  <div id="modal" class="mint-sprime-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Mint sPRIME
        <img class="sprime-logo"
             v-if="secondAssetSymbol"
             :src="`src/assets/logo/sprime-${secondAssetSymbol.toLowerCase()}.svg`"/>
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{ primeBalance | smartRound }}</div>
        <span class="top-info__currency">
          {{prime.symbol}}
        </span>
      </div>
      <CurrencyInput ref="primeInput"
                     :symbol="prime.symbol"
                     v-on:inputChange="primeInputChange"
                     :defaultValue="primeAmount"
                     :max="primeBalance"
                     :allow-zero-value="true"
                     :validators="primeInputValidators">
      </CurrencyInput>
      <div class="modal-top-info modal-top-info--reduced-margin">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{secondAssetAvailableBalance | smartRound }}</div>
        <span v-if="secondAsset" class="top-info__currency">
          {{secondAssetSymbol}}
        </span>
      </div>
      <CurrencyInput v-if="secondAsset"
                     ref="secondInput"
                     :symbol="secondAssetSymbol"
                     v-on:inputChange="secondInputChange"
                     :defaultValue="secondAmount"
                     :max="isSecondAssetNative ? nativeTokenBalance : secondAssetBalance"
                     :allow-zero-value="true"
                     :validators="secondInputValidators">
      </CurrencyInput>

      <div class="toggle-container" v-if="secondAssetSymbol === config.nativeToken">
        <Toggle v-on:change="wrappedAssetToggleChange" :options="[config.nativeToken, `W${config.nativeToken}`]"></Toggle>
      </div>


      <SlippageControl :slippage-margin="0.02" v-on:slippageChange="slippageChange"></SlippageControl>

      <div class="rebalance-container">
        <div class="rebalance-label">Rebalance:</div>
        <Toggle v-if="showRebalanceToggle" v-on:change="rebalanceToggleChange" :options="['YES', 'NO']" :initial-option="sPrimeActive ? 1 : 0"></Toggle>
        <div class="modal-top-info-bar">
          <div>
            Rebalancing will center your sPRIME around the current price.
          </div>
        </div>
      </div>

      <div class="button-wrapper">
        <Button :label="'Mint'"
                v-on:click="submit()"
                :waiting="transactionOngoing"
                :disabled="primeInputError || secondInputError || (!primeAmount && !secondAmount)">
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
import DoubleAssetIcon from "./DoubleAssetIcon.vue";
import SlippageControl from './SlippageControl.vue';
import ToggleButton from './notifi/settings/ToggleButton.vue';

const ethers = require('ethers');


export default {
  name: 'MintsPrimeModal',
  components: {
    ToggleButton,
    SlippageControl,
    DoubleAssetIcon,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle
  },

  props: {
    secondAssetSymbol: null,
    primeBalance: Number,
    sPrimeActive: false,
    secondAssetBalance: Number,
    nativeTokenBalance: Number,
    isSecondAssetNative: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      rebalance: true,
      primeAmount: null,
      secondAmount: null,
      primeInputValidators: [],
      secondInputValidators: [],
      addedLiquidity: 0,
      transactionOngoing: false,
      primeInputError: false,
      secondInputError: false,
      showRebalanceToggle: false,
      slippage: 0,
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
      this.$forceUpdate();
      this.rebalance = this.sPrimeActive;
      this.showRebalanceToggle = true;
    });
  },

  computed: {
    config() {
      return config
    },
    prime() {
      return config.ASSETS_CONFIG['PRIME'];
    },
    secondAsset() {
      return config.ASSETS_CONFIG[this.secondAssetSymbol];
    },

    secondAssetAvailableBalance() {
      return this.isSecondAssetNative ? this.nativeTokenBalance : this.secondAssetBalance;
    },
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const mintSPrimeEvent = {
        primeAmount: this.primeAmount,
        secondAmount: this.secondAmount,
        rebalance: this.rebalance,
        slippage: this.slippage,
        isSecondAssetNative: this.isSecondAssetNative
      };
      this.$emit('MINT', mintSPrimeEvent);
    },

    async primeInputChange(change) {
      console.log('primeInputChange', change);
      this.primeAmount = change;
      this.primeInputError = await this.$refs.primeInput.forceValidationCheck();
      await this.calculateSPrimeBalance();

    },

    async secondInputChange(change) {
      console.log('secondInputChange', change);
      this.secondAmount = change;
      this.secondInputError = await this.$refs.secondInput.forceValidationCheck();
      await this.calculateSPrimeBalance();
    },

    async calculateSPrimeBalance() {
    },

    rebalanceToggleChange(option) {
      this.rebalance = option === 'YES';
    },

    setupValidators() {
      this.primeInputValidators = [
        {
          validate: (value) => {
            if (value > this.primeBalance) {
              return `Exceeds your PRIME balance`;
            }
          }
        }
      ];

      this.secondInputValidators = [
        {
          validate: (value) => {
            let balance = this.isSecondAssetNative ? this.nativeTokenBalance : this.secondAssetBalance;
            if (value > balance) {
              return `Exceeds ${this.secondAsset.symbol} balance`;
            }
          }
        }
      ];

    },

    slippageChange(slippageChangeEvent) {
      console.log(slippageChangeEvent);
      this.slippage = slippageChangeEvent;
    },

    wrappedAssetToggleChange(asset) {
      this.isSecondAssetNative = asset === config.nativeToken;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.mint-sprime-modal-component {
  .rebalance-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    height: 140px;
    margin: 20px;

    .rebalance-label {
      color: var(--swap-modal__slippage-advanced-color);
      margin-right: 10px;
      font-weight: 500;
    }

  }

  .modal-top-info--reduced-margin {
    margin-top: 10px;
  }

  .modal__title {
    .sprime-logo {
      margin-left: 10px;
      width: 40px;
    }
  }

  .toggle-container {
    margin-top: 0;
    margin-bottom: 20px;
  }

}


</style>