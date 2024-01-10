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
import config from '../config';
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

const ethers = require('ethers');

export default {
  name: 'ConvertGlpToGmModal',
  components: {
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
      market: null
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
          targetMarketSymbol: this.market
        });
    },
    inputChange(event) {
      this.market = event.chosen;
    }
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