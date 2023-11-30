<template>
  <div v-if="asset" id="modal" class="add-from-wallet-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Create a Prime Account
      </div>
      <div class="modal-top-desc">
        <div>
          This action will deploy your <b>Prime Account</b> and add your
          collateral.
          <br><br>
        </div>
        <div>
          <b>It will require accepting Terms and 3 consecutive Metamask transactions.</b>
        </div>
      </div>
      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value" v-bind:class="{'available-balance--loading': !availableAssetAmount && availableAssetAmount !== 0}">
          <LoadedValue :check="() => availableAssetAmount != null || Number.isNaN(availableAssetAmount)"
                       :value="formatTokenBalance(availableAssetAmount, 10, true)"></LoadedValue>
          <div v-if="availableAssetAmount != null">
            <span class="top-info__currency">
              {{ asset.short ? asset.short : asset.symbol }}
            </span>
          </div>
        </div>
      </div>

      <CurrencyComboInput ref="sourceInput"
                          :asset-options="assetOptions"
                          :default-asset="asset"
                          :validators="validators"
                          :disabled="false"
                          :max="availableAssetAmount"
                          :typingTimeout="2000"
                          v-on:valueChange="inputChange"
                          v-on:ongoingTyping="ongoingTyping"
      >
      </CurrencyComboInput>

      <div class="button-wrapper">
       <Button :label="'Create account'"
                v-on:click="submit()"
                :disabled="validationError"
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

const ethers = require('ethers');

export default {
  name: 'CreateAccountModal',
  components: {
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
    assetOptions: {},
    logo: null,
    assetBalance: Number,
    walletAssetBalances: null,
    transactionOngoing: false
  },

  data() {
    return {
      value: 0,
      validators: [],
      validationError: true,
      availableAssetAmount: 0
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupAssetOptions();
      this.setupValidators();
    });
    setTimeout(() => {
      this.setupAvailableAssetAmount();
    }, 1);
  },

  computed: {
    ...mapState('network', ['account', 'accountBalance']),
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
        this.$emit('CREATE_ACCOUNT', {
          value: parseFloat(this.value).toFixed(this.asset.decimals),
          asset: this.asset
        });
    },

    async inputChange(changeEvent) {
      console.log(changeEvent)
      this.value = changeEvent.value;
      this.validationError = changeEvent.error;
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.availableAssetAmount) {
              return 'Exceeds account balance';
            }
          }
        },
        {
          validate: async (value) => {
            const allowed = this.asset.maxExposure - this.asset.currentExposure;
        
            if (value > allowed) {
              return `Max. allowed amount is ${allowed.toFixed(2)}.`;
            }
          }
        }
      ];
    },

    setupAssetOptions() {
      this.assetOptions = [];

      this.assets.forEach(assetSymbol => {
        const asset = config.ASSETS_CONFIG[assetSymbol];
        const assetOption = {
          symbol: assetSymbol,
          name: asset.name,
          logo: `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
        };
        this.assetOptions.push(assetOption);
      });
    },

    ongoingTyping(event) {
      this.isTyping = event.typing;
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