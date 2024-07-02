<template>
  <div id="modal" class="redeem-sprime-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Redeem sPRIME
        <img class="sprime-logo"
             v-if="secondAssetSymbol"
             :src="`src/assets/logo/sprime-${secondAssetSymbol.toLowerCase()}.svg`"/>
      </div>

      <div class="modal-top-info-bar">
        <div>
          Redeeming will unwind your sPRIME to <b>PRIME</b> and <b>wrapped {{secondAssetSymbol}}</b>.
        </div>
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available to redeem:
          <InfoIcon class="info__icon"
                    :tooltip="{content: 'Only unlocked sPRIME is available to redeem..', classes: 'info-tooltip'}"
                    :classes="'info-tooltip'"></InfoIcon>
        </div>
        <div class="top-info__value"> {{ unlockedInUsd | usd }} </div>
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
                {{(sPrimeBalance - sPrimeToRedeem) / sPrimeBalance * sPrimeValue | usd}}
<!--                {{sPrimeBalance - sPrimeToRedeem | smartRound}} sPRIME-->
              </div>
            </div>
<!--            <div class="summary__divider divider&#45;&#45;long light"></div>-->

<!--            <div class="summary__value__pair">-->
<!--              <div class="summary__label">-->
<!--                PRIME balance:-->
<!--              </div>-->
<!--              <div class="summary__value">-->
<!--                124 PRIME-->
<!--              </div>-->
<!--            </div>-->

<!--            <div class="summary__divider divider&#45;&#45;long light"></div>-->

<!--            <div class="summary__value__pair">-->
<!--              <div class="summary__label">-->
<!--                {{ secondAsset.symbol }} borrowed:-->
<!--              </div>-->
<!--              <div class="summary__value">-->
<!--                154 {{ secondAsset.symbol}}-->
<!--              </div>-->
<!--            </div>-->
          </div>
        </TransactionResultSummaryBeta>
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
import InfoIcon from "./InfoIcon.vue";

const ethers = require('ethers');


export default {
  name: 'RedeemsPrimeModal',
  components: {
    InfoIcon,
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
    sPrimeValue: Number,
    sPrimeLockedBalance: Number,
    sPrimeLockedValue: Number,
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
    },
    unlockedInUsd() {
      return this.sPrimeValue - this.sPrimeLockedValue;
    },
    unlockedInBalance() {
      return this.sPrimeBalance - this.sPrimeLockedBalance;
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
      this.sPrimeToRedeem = Number(this.unlockedInBalance) * change.value / 100;
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

  .modal__title {
    .sprime-logo {
      margin-left: 10px;
      width: 40px;
    }
  }
}


</style>