<template>
  <div class="currency-form-wrapper"
       :style="{
        'flex-direction': flexDirection
      }"
       v-bind:class="{'slim': slim}">
    <CurrencyInput
      :price="price"
      :max="max"
      :symbol="symbol"
      :validators="validators"
      :warnings="warnings"
      :waiting="waiting"
      :info="info"
      :defaultValue="defaultValue"
      :denominationButtons="denominationButtons"
      :slippage="slippage"
      :showPriceInAvax="showPriceInAvax"
      v-on:newValue="updateValue"
      v-on:ongoingErrorCheck="ongoingErrorCheck"
    />
    <Button :label="label" :disabled="disabled" :waiting="waiting" class="form-button" v-on:click="emitValue(true)"/>
  </div>
</template>


<script>
  import CurrencyInput from "./CurrencyInput";
  import Button from "./Button";

  export default {
    name: 'CurrencyForm',
    props: {
      label: { type: String, default: '' },
      price: { type: Number },
      max: { type: Number, default: null },
      symbol: { type: String, default: 'AVAX' },
      flexDirection: { type: String, default: 'column'},
      waiting: { type: Boolean, default: false },
      validators: {
        type: Array, default: () => []
      },
      warnings: {
        type: Array, default: () => []
      },
      info: { type: Function, default: null },
      defaultValue: { type: Number, default: null },
      denominationButtons: { type: Boolean, default: false },
      slippage: { type: Number, default: 0 },
      slim: {type: Boolean, default: false},
      showPriceInAvax: { type: Boolean, default: false }
    },
    components: {
      CurrencyInput,
      Button
    },
    data() {
      return {
        value: null,
        error: false,
        checkingInput: false
      }
    },
    computed: {
      disabled() {
        return this.value === null || this.value === 0 || this.waiting || this.error || this.checkingInput;
      }
    },
    methods: {
      updateValue(result) {
        this.value = result.value;
        this.error = result.error;
        this.$emit('changedValue', this.value);
      },
      ongoingErrorCheck(checking) {
        this.checkingInput = checking;
      },
      emitValue() {
        if (!this.disabled) {
          this.$emit('submitValue', this.value);
        }
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.currency-form-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
}
</style>
<style lang="scss">
@import "~@/styles/variables";

.currency-form-wrapper.slim {
  width: 100%;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;

  @media screen and (min-width: $md) {
    flex-wrap: nowrap;
    align-items: flex-start;
    align-self: center;
    width: min-content;
    margin-top: 45px;
  }


  .input-wrapper {
    height: 60px !important;
  }

  input {
    height: 30px;
    line-height: 30px;
  }

  .error, .info, .warning {
    text-align: left;
  }

  .logo {
    height: 30px;
    width: 30px;
    min-width: 30px;
    min-height: 30px;
  }

  .symbol {
    font-size: 16px;
  }

  .btn {
    padding: 13px 20px;
    margin-left: 30px;
    font-size: 20px;

    &.waiting .ball-beat:not(.active) {
      margin-top: 5px;
      margin-bottom: 5px;
    }
  }

  .value-wrapper .label {
    text-align: start;
  }

  .form-button {
    margin-bottom: 30px;
  }
}
</style>
