<template>
  <div class="form-input-wrapper">
    <div
      class="input-wrapper"
      @click="$refs.input.focus()"
    >
      <img
        v-if="leftIconSrc"
        class="input__prefix-icon"
        :src="leftIconSrc"
      >
      <input
        ref="input"
        v-bind:placeholder="placeholder"
        v-model="inputValue"
        @input="handleInput"
        :style="{ fontSize: fontSize + 'px' }"
        :disabled="disabled"
        @blur="handleBlur"
      >
    </div>

    <div
      v-if="error"
      class="error"
    >
      <img src="src/assets/icons/error.svg">
      {{ error }}
    </div>
  </div>
</template>

<script>

export default ({
  name: 'FormInput',
  components: {},
  props: {
    inputType: null,
    type: { type: String, default: 'text' },
    leftIconSrc: String,
    defaultValue: null,
    placeholder: { type: String, default: 'Input Here' },
    noSpace: Boolean,
    validators: { type: Array, default: () => [] },
    fontSize: { type: Number, default: 14 },
    disabled: { type: Boolean, default: false }
  },
  data() {
    return {
      inputValue: this.defaultValue,
      error: ''
    }
  },
  watch: {
    inputValue(value) {
      if (!this.noSpace) return;
      this.inputValue = value.replace(/ +/g, '');
    },
    defaultValue(value) {
      if (!value) return;
      this.inputValue = value;
    }
  },
  methods: {
    validateInput(value) {
      for (const validator of this.validators) {
        const isValid = validator.validate(value);

        if (isValid) return isValid;
      }

      return false;
    },

    handleInput() {
      if (this.inputType === 'number' && !this.inputValue.match(/^\d*[\.|\,]?\d{0,18}$/)) {
        this.inputValue = this.inputValue.substring(0, this.inputValue.length - 1);
      }

      let invalid;

      if (!this.inputValue || this.inputValue === '') {
        this.error = false;
      } else {
        invalid = this.validateInput(this.inputValue);
        this.error = invalid;
      }

      this.$emit('valueChange', {
        type: this.type,
        value: this.inputValue,
        invalid
      });
    },

    handleBlur() {
      this.$emit('blur', {});
    }
  }
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.form-input-wrapper {
  width: 100%;
  margin-top: 14px;

  .input-wrapper {
    padding: 10px 12px;
    width: 100%;
    height: 40px;
    display: flex;
    align-items: center;
    border-radius: 12px;
    border: var(--form-input__border);
    background-color: var(--form-input__background-color);

    .input__prefix-icon {
      width: 20px;
      object-fit: contain;
      margin-right: 8px;
    }

    input {
      padding: 0;
      flex: auto;
      background: transparent;
      border: none;
      color: var(--notifi-modal__container-common-color);
      font-family: 'Montserrat';
      font-weight: 500;
      font-style: normal;
      line-height: normal;
      letter-spacing: normal;

      &:focus {
        outline: none;
      }

      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
    }
  }

  .error {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 15px;
    padding-top: 2px;
    font-size: $font-size-xs;
    text-align: left;
    color: var(--form-input__error-color);

    img {
      width: 16px;
      height: 16px;
      object-fit: contain;
    }
  }
}

</style>