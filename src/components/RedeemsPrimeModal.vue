<template>
  <div id="modal" class="redeem-sprime-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Redeem sPRIME - {{ secondAsset.symbol}}
        <DoubleAssetIcon :size="'BIG'" :primary="'sPRIME'" :secondary="secondAsset.symbol"></DoubleAssetIcon>
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{ sPrimeBalance }}</div>
        <span class="top-info__currency">
          sPRIME - {{secondAsset.symbol}}
        </span>
      </div>

      <Slider :step="1" :min="0" :max="100" v-on:newValue="sliderChange"></Slider>

      <div class="transaction-summary-wrapper transaction-summary-wrapper--swap-modal">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div class="summary__value__pair">
              <div class="summary__label">
                sPRIME balance:
              </div>
              <div class="summary__value">
                {{sPrimeBalance - sPrimeToRedeem}} sPRIME
<!--                {{sPrimeBalance - sPrimeToRedeem | smartRound}} sPRIME-->
              </div>
            </div>
            <div class="summary__divider divider--long light"></div>

            <div class="summary__value__pair">
              <div class="summary__label">
                PRIME balance:
              </div>
              <div class="summary__value">
                124 PRIME
              </div>
            </div>

            <div class="summary__divider divider--long light"></div>

            <div class="summary__value__pair">
              <div class="summary__label">
                {{ secondAsset.symbol }} borrowed:
              </div>
              <div class="summary__value">
                154 {{ secondAsset.symbol}}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Max. slippage is 5%.</div>
      </div>

      <div class="button-wrapper">
        <Button :label="'Redeem'"
                :disabled="!sPrimeToRedeem"
                v-on:click="submit()"
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
import DoubleAssetIcon from './DoubleAssetIcon.vue';
import Slider from './Slider.vue';

const ethers = require('ethers');


export default {
  name: 'RedeemsPrimeModal',
  components: {
    Slider,
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
    sPrimeBalance: Number,
  },

  data() {
    return {
      transactionOngoing: false,
      sPrimeToRedeem: 0,
    };
  },

  mounted() {
  },

  computed: {
    secondAsset() {
      return config.ASSETS_CONFIG[this.secondAssetSymbol];
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const redeemSPrimeRequest = {
        sPrimeToRedeem: this.sPrimeToRedeem
      };
      this.$emit('REDEEM', redeemSPrimeRequest);
    },

    sliderChange(change) {
      this.sPrimeToRedeem = Number(this.sPrimeBalance) * change.value / 100;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.redeem-sprime-modal-component {

  .double-asset-icon-component {
    margin-left: 10px;
    height: 40px;
  }
}


</style>