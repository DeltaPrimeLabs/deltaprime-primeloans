<template>
  <div
    :class="[custom ? 'health-rate-custom' : '', active ? 'active' : '', 'health-rate-button']"
    @click="handleUpdate"
  >
    <div v-if="!custom">{{ rate.value }}%</div>
    <input
      v-if="custom"
      class="custom-input"
      v-model="customValue"
      :placeholder="placeholder"
      @input="handleInput"
      @blur="handleBlur"
      @focus="placeholder = '0'"
    >
    <span v-if="customValue || placeholder === '0'">%</span>
  </div>
</template>

<script>
export default ({
  name: 'HealthRateButton',
  components: {},
  props: {
    custom: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    rate: { type: Object, default: () => {} },
    selectedRate: null
  },
  data() {
    return {
      customValue: this.custom && this.rate.value,
      placeholder: 'Custom'
    }
  },
  methods: {
    handleUpdate() {
      const rate = this.rate;

      if (this.rate.id === 'custom') {
        if (!this.customValue || this.customValue === this.selectedRate) return;
        rate.value = this.customValue;
      }

      this.$emit('rateClick', rate);
    },

    handleInput() {
      if (!/^\d*[\.]?\d{0,2}$/.test(this.customValue)) {
        this.customValue = this.customValue.substring(0, this.customValue.length - 1);
      }
    },

    handleBlur() {
      this.placeholder = 'Custom';
      console.log(this.placeholder);
      this.handleUpdate();
    }
  }
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.health-rate-button {
  width: 60px;
  height: 32px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 100px;
  border: solid 1px var(--health-rate-button__border-color);
  background-color: var(--health-rate-button__background-color);
  font-size: 16px;
  line-height: normal;
  color: var(--health-rate-button__rate-inactive-color);
  cursor: pointer;

  &:hover {
    border: solid 1px var(--health-rate-button__active-border-color);
    background-color: var(--health-rate-button__active-background-color);
  }

  &.active {
    border: solid 2px var(--health-rate-button__active-border-color);
    background-color: var(--health-rate-button__active-background-color);
    box-shadow: var(--notifi-settings__box-shadow);
    color: var(--notifi-settings__active-option-font-color);
    font-weight: 600;
  }

  &:not(:first-child) {
    margin-left: 14px;
  }

  &.health-rate-custom {
    width: 90px;
    display: flex;
    justify-content: center;
    padding: 0 10px;

    .custom-input {
      flex: auto;
      width: 46px;
      height: 20px;
      border: none;
      outline: none;
      background: transparent;
      font-family: 'Montserrat';
      font-size: 16px;
    }
  }
}

</style>