<template>
  <div id="modal" v-if="lpToken" class="add-liquidity-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Create LB position
      </div>
      <div class="modal-top-desc">
        Open bins increase the gas consumption of Prime Account actions. <br><br>Open up multiple Prime Accounts or consider opening a reduced number of bins to prevent high gas fees.
        <br>
      </div>
      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{firstAssetBalance | smartRound(10, true)}}</div>
        <span class="top-info__currency">
          {{firstAsset.symbol}}
        </span>
      </div>
      <CurrencyInput ref="firstInput"
                     :symbol="firstAsset.symbol"
                     v-on:inputChange="firstInputChange"
                     :defaultValue="firstAmount"
                     :disabled="maxBelowActive"
                     :validators="firstInputValidators"
                     :max="maxBelowActive && firstAssetBalance">
      </CurrencyInput>
      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{secondAssetBalance | smartRound(10, true)}}</div>
        <span class="top-info__currency">
          {{secondAsset.symbol}}
        </span>
      </div>
      <CurrencyInput ref="secondInput"
                     :symbol="secondAsset.symbol"
                     v-on:inputChange="secondInputChange"
                     :defaultValue="secondAmount"
                     :disabled="minAboveActive"
                     :validators="secondInputValidators"
                     :max="secondAssetBalance">
      </CurrencyInput>

      <div class="liquidity-option shape">
        <div class="label-with-separator">
          Choose liquidity Shape
          <InfoIcon
            class="label__info-icon"
            :tooltip="{ content: 'Only spot is available now. Curve and bid-ask coming soon!', placement: 'top', classes: 'info-tooltip' }"
          ></InfoIcon>
        </div>
        <div class="liquidity-option__content">
          <div
            v-for="(shape, key) in liquidityShapes"
            :key="key"
            :class="['liquidity-shape', selectedShape === key ? 'active' : '', shape.disabled ? 'disabled' : '']"
            v-on:click="() => handleShapeClick(key)"
          >
            <img class="shape-icon" :src="shape.imgSrc" />
            <div class="shape-label">
              {{ shape.name }}
            </div>
          </div>
        </div>
      </div>

      <div class="liquidity-option">
        <div class="label-with-separator">
          Price range
        </div>
        <div class="active-price">Current price: 1 {{firstAsset.symbol}} = {{activePrice}} {{secondAsset.symbol}}</div>
        <div class="liquidity-option__content price-slider-wrapper">
          <RangeSlider
            ref="slider"
            :min="activeId - maxPriceRadius"
            :max="activeId + maxPriceRadius"
            :value="binRange"
            :validators="sliderValidators"
            :indicator="activeId"
            @input="updateBinRange"
          ></RangeSlider>
          <div class="price-range-inputs">
            <div class="price__input">
              <div class="input-label"><b>Min Price</b> | {{ secondAsset.symbol }} per {{ firstAsset.symbol }}</div>
              <FormInput
                :inputType="'number'"
                :default-value="binRange && !minPriceChanging && getBinPrice(binRange[0])"
                :fontSize="18"
                :noSpace="true"
                @valueChange="updateMinBinPrice"
                @blur="minPriceChanging = false"
              ></FormInput>
            </div>
            <div class="price__input">
              <div class="input-label"><b>Max Price</b> | {{ secondAsset.symbol }} per {{ firstAsset.symbol }}</div>
              <FormInput
                :inputType="'number'"
                :default-value="binRange && !maxPriceChanging && getBinPrice(binRange[1])"
                :fontSize="18"
                :noSpace="true"
                @valueChange="updateMaxBinPrice"
                @blur="maxPriceChanging = false"
              ></FormInput>
            </div>
          </div>
        </div>
      </div>

      <div class="slippage-bar">
        <div class="slippage-info">
          <span class="slippage-label">Max. price slippage:</span>
          <SimpleInput :percent="true" :default-value="priceSlippage" v-on:newValue="priceSlippageChange"></SimpleInput>
          <span class="percent">%</span>
        </div>
        <div class="slippage__divider"></div>
        <div class="slippage-info">
          <span class="slippage-label">Max. amounts slippage:</span>
          <SimpleInput :percent="true" :default-value="amountsSlippage" v-on:newValue="amountsSlippageChange"></SimpleInput>
          <span class="percent">%</span>
        </div>
      </div>

<!--      <div class="transaction-summary-wrapper summary">-->
<!--        <TransactionResultSummaryBeta>-->
<!--          <div class="summary__title">-->
<!--            Values after transaction:-->
<!--          </div>-->
<!--          <div class="summary__horizontal__divider"></div>-->
<!--          <div class="summary__values">-->
<!--            <div class="summary__value__pair">-->
<!--              <div class="summary__label">-->
<!--                {{ firstAsset.symbol }} balance:-->
<!--              </div>-->
<!--              <div class="summary__value">-->
<!--                {{ formatTokenBalance(Number(firstAssetBalance) - Number(firstAmount ? firstAmount : 0)) }}-->
<!--              </div>-->
<!--            </div>-->

<!--            <div class="summary__divider divider&#45;&#45;long"></div>-->
<!--            <div class="summary__value__pair">-->
<!--              <div class="summary__label">-->
<!--                {{ secondAsset.symbol }} balance:-->
<!--              </div>-->
<!--              <div class="summary__value">-->
<!--                {{ formatTokenBalance(Number(secondAssetBalance) - Number(secondAmount ? secondAmount : 0)) }}-->
<!--              </div>-->
<!--            </div>-->
<!--          </div>-->
<!--        </TransactionResultSummaryBeta>-->
<!--      </div>-->

      <div class="button-wrapper">
        <Button :label="'Add Liquidity'"
                v-on:click="submit()"
                :waiting="transactionOngoing"
                :disabled="firstInputError || secondInputError || sliderError">
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
import InfoIcon from './InfoIcon.vue';
import RangeSlider from './RangeSlider';
import FormInput from './FormInput';
import SimpleInput from "./SimpleInput.vue";
import Paginator from "./Paginator.vue";

const ethers = require('ethers');


export default {
  name: 'AddLiquidityModal',
  components: {
    Paginator,
    SimpleInput,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle,
    InfoIcon,
    RangeSlider,
    FormInput
  },

  props: {
    lpToken: {},
    lpTokens: {},
    firstAsset: null,
    secondAsset: null,
    firstAssetBalance: Number,
    secondAssetBalance: Number,
    activeId: null,
    activePrice: null,
    binStep: null
  },

  data() {
    return {
      firstAmount: null,
      secondAmount: null,
      firstInputValidators: [],
      secondInputValidators: [],
      sliderValidators: [],
      liquidityShapes: config.liquidityShapes,
      selectedShape: Object.keys(config.liquidityShapes)[0],
      binRange: [],
      transactionOngoing: false,
      firstInputError: false,
      secondInputError: false,
      sliderError: false,
      priceRadius: 5,
      maxPriceRadius: config.chainSlug === 'arbitrum' ? 60 : 50,
      minAboveActive: false,
      maxBelowActive: false,
      priceSlippage: 0.5,
      amountsSlippage: 0.5,
      minPriceChanging: false,
      maxPriceChanging: false
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
      this.setupSlider();
      this.firstInputChange(0);
      this.secondInputChange(0);
    });
  },

  computed: {
    isWithinMaxRange() {
      const flag = (this.binRange[0] >= this.activeId - this.maxPriceRadius) && (this.binRange[0] <= this.activeId + this.maxPriceRadius)
        && (this.binRange[1] >= this.activeId - this.maxPriceRadius) && (this.binRange[1] <= this.activeId + this.maxPriceRadius);

      return flag;
    }
  },

  methods: {
    async setupSlider() {
      this.binRange = [this.activeId - this.priceRadius, this.activeId + this.priceRadius];
    },

    getBinPrice(binId) {
      const binPrice = (1 + this.binStep / 10000) ** (binId - 8388608) * 10 ** (this.firstAsset.decimals - this.secondAsset.decimals);
      return binPrice.toFixed(5);
    },

    getBinId(price) {
      const binId = Math.trunc(Math.log(price / (10 ** (this.firstAsset.decimals - this.secondAsset.decimals))) / Math.log(1 + this.binStep / 10000)) + 8388608;
      return binId;
    },

    submit() {
      this.transactionOngoing = true;

      const addLiquidityEvent = {
        firstAsset: this.firstAsset,
        secondAsset: this.secondAsset,
        tokenXAmount: this.maxBelowActive ? 0 : this.firstAmount,
        tokenYAmount: this.minAboveActive ? 0 : this.secondAmount,
        distributionMethod: this.liquidityShapes[this.selectedShape].distributionMethod,
        binRange: this.binRange,
        priceSlippage: this.priceSlippage,
        amountsSlippage: this.amountsSlippage
      };

      this.$emit('ADD_LIQUIDITY', addLiquidityEvent);
    },

    async firstInputChange(change) {
      this.firstAmount = change;
      this.firstInputError = await this.$refs.firstInput.forceValidationCheck();
    },

    async secondInputChange(change) {
      this.secondAmount = change;
      this.secondInputError = await this.$refs.secondInput.forceValidationCheck();
    },

    async updateBinRange({value, error}) {
      this.error = error;
      this.binRange = value;
      if (this.activeId < value[0] && this.minAboveActive === false) {
        this.minAboveActive = true;
      } else if (this.activeId >= value[0] && this.minAboveActive === true) {
        this.minAboveActive = false;
      }

      if(value[1] < this.activeId && this.maxBelowActive === false) {
        this.maxBelowActive = true;
      } else if (value[1] >= this.activeId && this.maxBelowActive === true) {
        this.maxBelowActive = false; 
      }

      this.sliderError = this.$refs.slider.error;

      this.firstInputError = await this.$refs.firstInput.forceValidationCheck();
      this.secondInputError = await this.$refs.secondInput.forceValidationCheck();
    },

    updateMinBinPrice({value, invalid}) {
      const binId = this.getBinId(value);
      this.minPriceChanging = true;

      this.binRange = [binId, this.binRange[1]];
    },

    updateMaxBinPrice({value, invalid}) {
      const binId = this.getBinId(value);
      this.maxPriceChanging = true;

      this.binRange = [this.binRange[0], binId];
    },

    handleShapeClick(key) {
      if (!this.liquidityShapes[key].disabled) this.selectedShape = key;
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

      this.sliderValidators = [
        {
          validate: (addedRange) => {
            let newBins = [];
            for (let i = addedRange[0]; i <= addedRange[1]; i++) {
              newBins.push(i);
            }

            const noOfBins = [...new Set([...this.lpToken.binIds ,...newBins])].length;

            let otherBins = Object.entries(this.lpTokens).filter(([,v]) => v.address !== this.lpToken.address).map(([,v]) => v).reduce((a, b) => a + b.binIds.length, 0);

            let binsTotal = noOfBins + otherBins;

            if (config.maxTraderJoeV2Bins && binsTotal > config.maxTraderJoeV2Bins) {
              return `Max. number of bins in a Prime Account: ${config.maxTraderJoeV2Bins}. Current number: ${binsTotal}`;
            }
          }
        },
        {
          validate: (addedRange) => {
            if (addedRange[0] > addedRange[1]) {
              return "Invalid range. The min price must be lower than the max price.";
            }
          }
        }
      ];

    },

    async priceSlippageChange(changeEvent) {
      this.priceSlippage = changeEvent.value ? changeEvent.value : 0;
    },

    async amountsSlippageChange(changeEvent) {
      this.amountsSlippage = changeEvent.value ? changeEvent.value : 0;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.add-liquidity-modal-component {
  .modal__title {
    margin-bottom: 43px;
  }
  .modal-top-info {
    margin-top: 5px;
  }
  .modal-top-desc {
    text-align: center;
  }
  .liquidity-option {
    display: flex;
    flex-direction: column;
    &.shape {
      margin-top: 10px;
    }
    .label-with-separator {
      font-family: Montserrat;
      font-size: $font-size-sm;
      font-weight: 600;
      font-stretch: normal;
      font-style: normal;
      line-height: normal;
      letter-spacing: normal;
      text-align: left;
      color: var(--traderjoe-add-liquidity-modal__label-with-separator);
      display: flex;
      align-items: center;
      &:after {
        content: "";
        display: block;
        background-color: var(--traderjoe-add-liquidity-modal__label-with-separator-background);
        height: 2px;
        flex-grow: 1;
        margin-left: 10px;
      }
      .label__info-icon {
        margin-left: 8px;;
      }
    }
    .active-price {
      margin-top: 10px;
      font-size: 14px;
      color: var(--traderjoe-add-liquidity-modal__price-slider-input-color);
    }
    .liquidity-option__content {
      width: 100%;
      margin: 30px 0;
      display: flex;
      justify-content: space-between;
      .liquidity-shape {
        width: 170px;
        height: 100px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 18px 0 6px;
        border-radius: 15px;
        border: var(--traderjoe-add-liquidity-modal__liquidity-shape-border);
        cursor: pointer;

        &.disabled {
          cursor: initial;
        }

        .shape-icon {
          margin: 0 37px;
          filter: grayscale(1);
          opacity: 0.75;
        }
        .shape-label {
          margin-top: 6px;
          font-family: Montserrat;
          font-size: $font-size-sm;
          font-weight: 500;
          font-stretch: normal;
          font-style: normal;
          line-height: normal;
          letter-spacing: normal;
          text-align: left;
        }
        &.active {
          border: var(--traderjoe-add-liquidity-modal__liquidity-shape-border-active);
          box-shadow: var(--traderjoe-add-liquidity-modal__liquidity-shape-box-shadow);
          background-color: var(--traderjoe-add-liquidity-modal__liquidity-shape-background);
          .shape-icon {
            filter: grayscale(0);
            opacity: 1;
          }
          .shape-label {
            font-weight: 600;
          }
        }
        &:hover &:not(.disabled) {
          border-color: var(--traderjoe-add-liquidity-modal__liquidity-shape-border-hover);
        }
      }
      &.price-slider-wrapper {
        display: flex;
        flex-direction: column;
        margin-top: 20px;
        .price-range-inputs {
          margin-top: 25px;
          display: flex;
          justify-content: space-around;
          .price__input {
            width: 260px;
            .input-label {
              font-family: Montserrat;
              font-size: $font-size-xsm;
              color: var(--traderjoe-add-liquidity-modal__price-slider-input-color);
            }
          }
        }
      }
    }
  }
  .summary {
    margin-top: 5px;
  }
  .button-wrapper {
    margin-top: 20px;
  }
}


</style>
