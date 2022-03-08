<template>
  <div class="currency-form-wrapper"
       :style="{
        'flex-direction': flexDirection
      }">
    <CurrencyInput
      :price="price"
      :max="max"
      :symbol="symbol"
      :validators="validators"
      :warnings="warnings"
      :waiting="waiting"
      :info="info"
      :defaultValue="defaultValue"
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
      defaultValue: { type: Number, default: null }
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

.form-button {
  margin-top: 1px;
}
</style>
<style lang="scss">
</style>
