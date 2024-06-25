<template>
  <div id="modal" class="mint-sprime-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Mint sPRIME
        <DoubleAssetIcon :size="'BIG'" :primary="'sPRIME'" :secondary="secondAssetSymbol"></DoubleAssetIcon>
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{ primeBalance }}</div>
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
        <div class="top-info__value"> {{secondAssetBalance}}</div>
        <span class="top-info__currency">
          {{secondAsset.symbol}}
        </span>
      </div>
      <CurrencyInput ref="secondInput"
                     :symbol="secondAsset.symbol"
                     v-on:inputChange="secondInputChange"
                     :defaultValue="secondAmount"
                     :max="secondAssetBalance"
                     :allow-zero-value="true"
                     :validators="secondInputValidators">
      </CurrencyInput>

      <SlippageControl :slippage-margin="0.02" v-on:slippageChange="slippageChange"></SlippageControl>

      <div class="rebalance-container">
        <div class="rebalance-label">Rebalance:</div>
        <Toggle v-on:change="rebalanceToggleChange" :options="['YES', 'NO']" :initial-option="1"></Toggle>
      </div>

      <div class="button-wrapper">
        <Button :label="'Mint'"
                v-on:click="submit()"
                :waiting="transactionOngoing"
                :disabled="primeInputError || secondInputError">
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
    secondAssetBalance: Number,
  },

  data() {
    return {
      rebalance: false,
      primeAmount: null,
      secondAmount: null,
      primeInputValidators: [],
      secondInputValidators: [],
      addedLiquidity: 0,
      transactionOngoing: false,
      primeInputError: false,
      secondInputError: false,
      slippage: 0,
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
    });
  },

  computed: {
    prime() {
      return config.ASSETS_CONFIG['PRIME'];
    },
    secondAsset() {
      return config.ASSETS_CONFIG[this.secondAssetSymbol];
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const mintSPrimeEvent = {
        primeAmount: this.primeAmount,
        secondAmount: this.secondAmount,
        rebalance: this.rebalance,
        slippage: this.slippage
      };
      this.$emit('MINT', mintSPrimeEvent);
    },

    async primeInputChange(change) {
      this.primeAmount = change;
      this.primeInputError = await this.$refs.primeInput.forceValidationCheck();
      await this.calculateSPrimeBalance();

    },

    async secondInputChange(change) {
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
            if (value > this.secondAssetBalance) {
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
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.mint-sprime-modal-component {
  .rebalance-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    margin: 20px;

    .rebalance-label {
      color: var(--swap-modal__slippage-advanced-color);
      margin-right: 10px;
    }
    
  }

  .modal-top-info--reduced-margin {
    margin-top: 10px;
  }

}


</style>