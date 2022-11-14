<template>
  <div id="modal" v-if="lpToken" class="provide-liquidity-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Provide Liquidity
      </div>

      <CurrencyInput ref="firstInput"
                     :symbol="firstAsset.symbol"
                     v-on:inputChange="firstInputChange"
                     :defaultValue="firstAmount"
                     :validators="firstInputValidators"
                     :max="Number(firstAssetBalance)">
      </CurrencyInput>
      <CurrencyInput ref="secondInput"
                     :symbol="secondAsset.symbol"
                     v-on:inputChange="secondInputChange"
                     :defaultValue="secondAmount"
                     :validators="secondInputValidators"
                     :max="Number(secondAssetBalance)">
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__values">
            <div class="summary__value__pair">
              <div class="summary__label">
                LP balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(Number(lpTokenBalance) + Number(addedLiquidity), 10, true) }}
              </div>
            </div>
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                {{ firstAsset.symbol }} balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(Number(firstAssetBalance) - Number(firstAmount)) }}
              </div>
            </div>

            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                {{ secondAsset.symbol }} balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(Number(secondAssetBalance) - Number(secondAmount)) }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Provide liquidity'"
                v-on:click="submit()"
                :waiting="transactionOngoing"
                :disabled="firstInputError || secondInputError">
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
import config from "../config";
import {erc20ABI} from "../utils/blockchain";
import {fromWei} from "../utils/calculate";
const ethers = require('ethers');


export default {
  name: 'ProvideLiquidityModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle
  },

  props: {
    lpToken: {},
    lpTokenBalance: Number,
    firstAssetBalance: Number,
    secondAssetBalance: Number,
  },

  data() {
    return {
      firstAmount: null,
      secondAmount: null,
      firstInputValidators: [],
      secondInputValidators: [],
      addedLiquidity: 0,
      transactionOngoing: false,
      firstInputError: false,
      secondInputError: false,
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
    });
  },

  computed: {
    firstAsset() {
      return config.ASSETS_CONFIG[this.lpToken.primary];
    },
    secondAsset() {
      return config.ASSETS_CONFIG[this.lpToken.secondary];
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      this.$emit('PROVIDE_LIQUIDITY',
          { firstAsset: this.firstAsset, secondAsset: this.secondAsset, firstAmount: this.firstAmount, secondAmount: this.secondAmount });
    },

    async firstInputChange(change) {
      this.firstAmount = change;
      this.secondAmount = this.firstAmount * this.lpToken.firstPrice / this.lpToken.secondPrice;
      this.$refs.secondInput.setValue(this.secondAmount !== 0 ? this.secondAmount.toFixed(15): 0);
      this.firstInputError = await this.$refs.firstInput.forceValidationCheck();
      this.secondInputError = await this.$refs.secondInput.forceValidationCheck();
      await this.calculateLpBalance();
    },

    async secondInputChange(change) {
      this.secondAmount = change;
      this.firstAmount = this.secondAmount * this.lpToken.secondPrice / this.lpToken.firstPrice;
      this.$refs.firstInput.setValue(this.firstAmount !== 0 ? this.firstAmount.toFixed(15) : 0);
      this.firstInputError = await this.$refs.firstInput.forceValidationCheck();
      this.secondInputError = await this.$refs.secondInput.forceValidationCheck();
      await this.calculateLpBalance();
    },

    async calculateLpBalance() {
      const lpToken = new ethers.Contract(this.lpToken.address, erc20ABI, provider.getSigner());
      const firstToken = new ethers.Contract(this.firstAsset.address, erc20ABI, provider.getSigner());
      const secondToken = new ethers.Contract(this.secondAsset.address, erc20ABI, provider.getSigner());

      const totalSupply = fromWei(await lpToken.totalSupply());
      const firstTokenBalance = fromWei(await firstToken.balanceOf(this.lpToken.address));
      const secondTokenBalance = fromWei(await secondToken.balanceOf(this.lpToken.address));

      this.addedLiquidity = Math.min(this.firstAmount * totalSupply / firstTokenBalance,
          this.secondAmount * totalSupply / secondTokenBalance);
    },

    setupValidators() {
      this.firstInputValidators = [
        {
          validate: (value) => {
            if (value > this.firstAssetBalance) {
              return `Exceeds ${this.firstAsset.symbol} balance`;
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
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.provide-liquidity-modal-component {

}


</style>