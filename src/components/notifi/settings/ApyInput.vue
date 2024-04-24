<template>
  <div class="apy-input">
    <input
      v-model="inputValue"
      @input="handleInput"
    >
    <span class="input-unit">APY&nbsp;%</span>
  </div>
</template>

<script>
export default ({
  name: 'ApyInput',
  components: {},
  props: {},
  data() {
    return {
      inputValue: null
    }
  },
  methods: {
    handleInput() {
      if (!/^\d*[\.]?\d{0,2}$/.test(this.inputValue)) {
        this.inputValue = this.inputValue.substring(0, this.inputValue.length - 1);
        return;
      }
      this.$emit('apyInput', this.inputValue);
    }
  }
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.apy-input {
  display: flex;
  align-items: center;
  width: 100%;
  height: 40px;
  padding: 12px 14px;
  border-radius: 12px;
  box-shadow: var(--apy-input__box-shadow);
  background-image: var(--apy-input__background-image);

  input {
    width: 100%;
    height: 100%;
    outline: none;
    border: none;
    background: transparent;
    margin: 0;
    padding: 0;
    font-size: 16px;
    font-weight: 600;
    font-family: 'Montserrat';
    color: var(--apy-input__font-color);
  }

  .input-unit {
    font-size: 14px;
    color: var(--apy-input__unit-font-color);
  }
}

</style>