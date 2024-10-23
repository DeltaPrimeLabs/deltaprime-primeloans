<template>
  <div id="modal" class="add-from-wallet-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Convert GLP to GM
      </div>
      <div class="modal-top-desc">
        <div>
          GLP in your wallet: {{ walletGlpBalance }}
        </div>
        <div>
          GLP in your Prime Account: {{ smartLoanGlpBalance }}
        </div>
      </div>

      <div>Convert to:</div>

      <AssetDropdown
          v-if="gmOptions"
        :asset-options="gmOptions"
        :default-asset="Object.keys(gmOptions)[0]"
        v-on:valueChange="inputChange"
      ></AssetDropdown>

      <Slider class="slider" :step="1" :min="0" :max="100" v-on:newValue="sliderChange"></Slider>
      <div class="modal-selected-amount">
        Selected GLP amount:
        <br>
        {{ amountToRedeem }}
      </div>

      <div class="button-wrapper">
       <Button :label="'Convert'"
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
import {mapState} from 'vuex';
import LoadedValue from './LoadedValue';
import CurrencyComboInput from "./CurrencyComboInput.vue";
import AssetDropdown from "./AssetDropdown.vue";
import Slider from "./Slider.vue";

const ethers = require('ethers');

export default {
  name: 'ConvertGlpToGmModal',
  components: {
    Slider,
    AssetDropdown,
    CurrencyComboInput,
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
    gmOptions: [],
    smartLoanGlpBalance: null,
    walletGlpBalance: null,
    transactionOngoing: false
  },

  data() {
    return {
      market: null,
      amountToRedeem: 0,
    };
  },

  mounted() {
  },

  computed: {
    ...mapState('network', ['account']),
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
        this.$emit('ZAP_CONVERT_GLP_TO_GM_EVENT', {
          targetMarketSymbol: this.market,
          amount: this.amountToRedeem
        });
    },
    inputChange(event) {
      this.market = event.chosen;
    },

    sliderChange(change) {
      this.amountToRedeem = (Number(this.smartLoanGlpBalance) + Number(this.walletGlpBalance)) * change.value / 100;
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

.modal-selected-amount {
  width: 100%;
  text-align: center;
}

.slider {
  margin-top: 16px;
}
</style>