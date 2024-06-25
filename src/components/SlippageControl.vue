<template>
  <div class="slippage-control-component">

    <div class="slippage-option slippage">
      <div class="label-with-separator">
        Acceptable Slippage
        <InfoIcon
          class="label__info-icon"
          :tooltip="{ content: 'Choose the maximum slippage you are willing to accept', placement: 'top', classes: 'info-tooltip' }"
        ></InfoIcon>
        <div class="vertical-separator"></div>
        <div class="advanced-mode">
          Advanced Mode
          <ToggleButton ref="advancedModeToggle"
                        class="advanced-mode-toggle"
                        v-on:toggleChange="advancedModeToggle()">
          </ToggleButton>
        </div>
      </div>
      <div v-if="!advancedSlippageMode" class="slippage-wrapper">
        <div class="slippage-option__content">
          <div
            v-for="(option, key) in slippageOptions"
            class="slippage-option-tile"
            :key="key"
            :class="[selectedSlippageOption === key ? 'active' : '', option.disabled ? 'disabled' : '']"
            v-tooltip="{ content: option.tooltip, placement: 'bottom', classes: 'info-tooltip' }"
            v-on:click="() => handlePriceImpactClick(key)"
          >
            <div class="slippage-label">
              {{ option.name }} {{ option.value / 100 | percent }}
            </div>
          </div>
        </div>
      </div>

      <div class="advanced-slippage slippage-bar slippage-bar--embedded" v-if="advancedSlippageMode">
        <span class="max-slippage-label">Max. acceptable slippage:</span>
        <SimpleInput :percent="true" :default-value="userSlippage" v-on:newValue="userSlippageChange"></SimpleInput>
        <span class="percent">%</span>
        <div class="slippage__divider"></div>
      </div>
    </div>
    
  </div>
</template>

<script>
import SimpleInput from './SimpleInput.vue';
import ToggleButton from './notifi/settings/ToggleButton.vue';
import InfoIcon from './InfoIcon.vue';
import config from '../config';

export default {
  name: 'SlippageControl',
  components: {InfoIcon, ToggleButton, SimpleInput},
  props: {
    slippageMargin: {
      type: Number,
      default: 0.05
    },
  },
  
  data() {
    return {
      slippageOptions: config.SWAP_MODAL_SLIPPAGE_OPTIONS,
      selectedSlippageOption: Object.keys(config.SWAP_MODAL_SLIPPAGE_OPTIONS)[1],
      advancedSlippageMode: false,
      userSlippage: 1,
    }
  },

  mounted() {
    this.setupAdvancedSlippageMode();
  },

  methods: {

    setupAdvancedSlippageMode() {
      this.advancedSlippageMode = localStorage.getItem('ADVANCED_SLIPPAGE_MODE') === 'true';
      this.$refs.advancedModeToggle.setValue(this.advancedSlippageMode);
    },

    async handlePriceImpactClick(key) {
      console.log(key);
      if (!this.slippageOptions[key].disabled) {
        this.blockSubmitButton = false;
        this.selectedSlippageOption = key;
        this.userSlippage = this.slippageOptions[key].value;
        this.$emit('slippageChange', this.userSlippage);
      }
    },


    async advancedModeToggle() {
      this.blockSubmitButton = false;
      this.advancedSlippageMode = !this.advancedSlippageMode;
      localStorage.setItem('ADVANCED_SLIPPAGE_MODE', this.advancedSlippageMode);
      if (this.advancedSlippageMode) {
        this.userSlippage = this.slippageMargin;
      } else {
        this.handlePriceImpactClick('medium');
      }
      this.$emit('slippageChange', this.userSlippage);
    },

    async userSlippageChange(changeEvent) {
      this.userSlippage = changeEvent.value;
      this.$emit('slippageChange', this.userSlippage);
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.slippage-control-component {
  padding-bottom: 20px;
  border-bottom: 2px solid var(--swap-modal__label-with-separator-background);

  .slippage-option {
    display: flex;
    flex-direction: column;
    &.slippage {
      margin-top: 10px;
    }
    .label-with-separator {
      font-family: Montserrat;
      font-size: $font-size-md;
      font-weight: 600;
      font-stretch: normal;
      font-style: normal;
      line-height: normal;
      letter-spacing: normal;
      text-align: left;
      color: var(--swap-modal__label-with-separator);
      display: flex;
      align-items: center;
      &:after {
        content: "";
        display: block;
        background-color: var(--swap-modal__label-with-separator-background);
        height: 2px;
        flex-grow: 1;
        margin-left: 10px;
      }
      .label__info-icon {
        margin-left: 8px;
      }

      .vertical-separator {
        width: 2px;
        height: 17px;
        background-color: var(--swap-modal__label-with-separator-background);
        margin: 0 10px;
      }
    }
  }

  .slippage-wrapper {
    display: flex;
    flex-direction: column;
    margin-top: 24px;
    margin-bottom: 2px;
    width: 100%;

    .slippage-option__content {
      width: 100%;
      display: flex;
      justify-content: space-between;

      .slippage-option-tile {
        height: 32px;
        padding: 0 13px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: 20px;
        border: var(--swap-modal__liquidity-shape-border);
        cursor: pointer;
        color: var(--swap-modal__slippage-option-pill-color);

        &.disabled {
          cursor: initial;
        }

        .slippage-label {
          font-family: Montserrat;
          font-size: $font-size-sm;
          font-stretch: normal;
          font-style: normal;
          line-height: normal;
          letter-spacing: normal;
          text-align: left;
        }

        &.active {
          padding: 0 10px;
          border: var(--swap-modal__liquidity-shape-border-active);
          box-shadow: var(--swap-modal__liquidity-shape-box-shadow);
          background-color: var(--swap-modal__liquidity-shape-background);
          color: var(--swap-modal__slippage-option-pill-color--active);

          .slippage-label {
            font-weight: 600;
          }
        }

        &:hover &:not(.disabled) {
          border-color: var(--swap-modal__liquidity-shape-border-hover);
        }
      }
    }
  }

  .advanced-slippage {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    margin: 26px 0 6px 0;

    .max-slippage-label {
      margin-right: 5px;
      color: var(--swap-modal__slippage-advanced-color);
    }

    .percent {
      color: var(--swap-modal__slippage-advanced-color);
      margin-left: 5px;
    }
  }

  .advanced-mode-toggle {
    margin-left: 8px;
  }

  .advanced-mode {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    color: var(--swap-modal__slippage-advanced-color);
    font-size: $font-size-xsm;
    font-weight: 500;
  }
}

</style>