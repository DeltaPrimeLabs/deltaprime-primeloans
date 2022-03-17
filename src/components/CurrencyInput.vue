<template>
  <div class="currency-input-wrapper">
    <div class="input-wrapper"
         :style="{ 'margin-top': flexDirection === 'column-reverse' ? '40px' : '0'}"
          @click="$refs.input.focus()">
      <span class="input"><input type="number" ref="input" pattern="[0-9]+" v-model.number="value" step="0.0001" placeholder="0" min="0" max="999999" lang="en-US"></span>
      <div class="converted">
        <div v-if="value && (value !== 0)">
          <span v-if="usdDenominated">{{ (price ? price : avaxPrice) * (1 + slippage) * value | usd}}</span>
          <span v-else>{{ (value * price * (1 + slippage) / avaxPrice).toPrecision(8) }}</span>
        </div>
      </div>
      <div class="denomination" v-if="denominationButtons">
        <img class="icon" :src="`src/assets/logo/${usdDenominated ? 'grey/' : ''}avax.svg`"  @click="usdDenominated = false"/>
        <img class="slash" src="src/assets/icons/slash-small.svg"/>
        <img class="icon" :src="`src/assets/logo/${!usdDenominated ? 'grey/' : ''}usd.svg`" @click="usdDenominated = true"/>
      </div>
      <div v-if="max" class="max-wrapper" @click.stop="value = max">
        <div class="max">MAX</div>
      </div>
      <div class="logo-wrapper">
        <img class="logo" :src="logoSrc(symbol)"/>
        <span v-if="!isMobile" class="symbol">{{ symbol }}</span>
      </div>
    </div>
    <div class="info"
         v-if="!error"
         :style="{'order': flexDirection === 'row' ? 1 : ''}">
      <div
        v-if="info && value && !isNaN(value) && !waiting && !ongoingErrorCheck"
        v-html="info(value)"></div>
    </div>
    <div class="error"
         v-if="error"
         :style="{'order': flexDirection === 'row' ? 1 : ''}">
      <span>
        <img src="src/assets/icons/error.svg"/>
        {{error}}
      </span>
    </div>
    <div class="warning"
         v-if="warning && !waiting && !ongoingErrorCheck">
      <span>
        <img src="src/assets/icons/warning.svg"/>
        {{warning}}
      </span>
    </div>
  </div>
</template>


<script>
import config from "@/config";
import {mapState} from "vuex";

  export default {
    name: 'CurrencyInput',
    props: {
      price: { type: Number },
      max: { type: Number, default: null },
      symbol: { type: String, default: 'AVAX' },
      flexDirection: { type: String, default: 'column'},
      validators: {
        type: Array, default: () => []
      },
      warnings: {
        type: Array, default: () => []
      },
      //TODO: make an array like in validators
      info: { type: Function, default: null },
      defaultValue: null,
      waiting: false,
      disabled: false,
      denominationButtons: false,
      slippage: { type: Number, default: 0 }
    },
    computed: {
      ...mapState('network', ['avaxPrice'])
    },
    data() {
      return {
        error: '',
        warning: '',
        value: this.defaultValue,
        defaultValidators: [],
        asset: config.ASSETS_CONFIG[this.symbol],
        ongoingErrorCheck: false,
        usdDenominated: true
      }
    },
    created() {
      this.defaultValidators.push(this.positiveValidator, this.wrongFormatValidator);
    },
    watch: {
      value: function (newValue) {
        this.updateValue(newValue);
      },
      defaultValue: function(newValue) {
        this.value = newValue;
      },
      warnings: function() {
        this.checkWarnings(this.value);
      },
      validators: function() {
        this.checkErrors(this.value);
      },
    },
    methods: {
      async updateValue(value) {
        this.ongoingErrorCheck = true;
        this.$emit('ongoingErrorCheck', this.ongoingErrorCheck);
        await this.checkErrors(value);
        this.ongoingErrorCheck = false;
        this.$emit('ongoingErrorCheck', this.ongoingErrorCheck);

        await this.checkWarnings(value);

        const hasError = this.error.length > 0;

        this.$emit('newValue', {value: value, error: hasError});
      },
      async checkWarnings(newValue) {
        this.warning = '';

        for (const validator of [...this.warnings]) {
          let value = typeof newValue === "number" ? newValue : 0;

          let validatorResult = await validator.validate(value);
          if (validatorResult) {
            this.warning = validatorResult;
          }
        }
      },
      async checkErrors(newValue) {
        this.error = '';

        for (const validator of [...this.validators, ...this.defaultValidators]) {
          let value = typeof newValue === "number" ? newValue : 0;

          let validatorResult = await validator.validate(value);
          if (validatorResult) {
            this.error = validatorResult;
          }
        }
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.input-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: inset 3px 3px 8px rgba(191, 188, 255, 0.5);
  background-image: linear-gradient(114deg, rgba(115, 117, 252, 0.08) 39%, rgba(255, 162, 67, 0.08) 62%, rgba(245, 33, 127, 0.08) 81%);
  height: 68px;
  border-radius: 15px;
  padding-left: 15px;
  padding-right: 15px;
  border: none;
  width: 100%;

  @media screen and (min-width: $md) {
    padding-left: 30px;
    padding-right: 20px;
  }
}

.input {
  position: relative;
  &:after {
    content: ' ';
    position: absolute;
    width: 25px;
    right: 0;
    height: 100%;
    top: 0;
    background: linear-gradient(to right, rgba(244, 244, 255, 0), rgba(244, 244, 255, 0.95) 50%);
    z-index: 1;
  }
}

input {
  background: transparent;
  border: none;
  font-family: Montserrat;
  font-weight: 600;
  font-size: 24px;
  padding-top: 0;
  padding-bottom: 0;
  max-width: 40%;

  @media screen and (min-width: $md) {
    padding-right: 5px;
    max-width: none;
  }
}

input:focus{
  outline: none;
}

// hiding arrows
/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type=number] {
  -moz-appearance: textfield;
}

.converted {
  color: #696969;
  margin-right: 15px;
  white-space: nowrap;
  text-align: right;
  width: 140px;
  font-size: $font-size-sm;
  opacity: 0.6;
  display: none;

  @media screen and (min-width: $md) {
    display: block;
  }

  > div {
    text-overflow: ellipsis;
    overflow: hidden;
  }
}

.symbol {
  margin-left: 10px;
  font-family: 'Lato';
  font-weight: 900;
  font-size: 18px;
}

.logo-wrapper {
  display: flex;
  align-items: center;
}

.max-wrapper {
  cursor: pointer;
  width: 35px;
  min-width: 35px;
  margin-right: 20px;


  .max {
    border: solid 1px #8986fe;
    border-radius: 10px;
    width: 45px;
    height: 26px;
    font-weight: bold;
    line-height: 24px;
    color: #8986fe;
    text-align: center;
    background-color: rgba(255, 255, 255, 0.2);

    &:hover {
      background-color: rgba(255, 255, 255, 0.9);
    }
  }
}

img {
  height: 24px;
  width: 24px;

  @media screen and (min-width: $md) {
    height: 36px;
    width: 36px;
  }
}

.error, .info, .warning {
  min-height: 30px;
  padding-top: 6px;
  color: #7d7d7d;
  font-size: 14px;
  width: 100%;
  text-align: end;
}

.warning {
  color: #F5A200;
}

.error, .warning {
  img {
    width: 20px;
    height: 20px;
    transform: translateY(-1px);
  }
}
.error {
  color: $red;
}

.denomination {
  min-width: 90px;

  .icon {
    width: 20px;
    cursor: pointer;

    &:hover {
      transform: scale(1.05);
    }
  }

  .slash {
    height: 24px;
    width: 12px;
  }
}
</style>
