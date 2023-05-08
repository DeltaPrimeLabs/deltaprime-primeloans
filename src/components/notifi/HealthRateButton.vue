<template>
  <div
    v-if="!custom"
    :class="['health-rate-button', active ? 'active' : '']"
    @click="handleClick"
  >
    {{ rate.value }}%
  </div>
</template>

<script>
export default ({
  name: 'HealthRateButton',
  components: {},
  props: {
    custom: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    rate: { type: Object, default: () => {} }
  },
  data() {
    return {}
  },
  methods: {
    handleClick() {
      this.$emit('rateClick', this.rate);
    }
  }
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.health-rate-button {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border: solid 1px var(--health-rate-button__border-color);
  border-radius: 100px;
  background-color: var(--health-rate-button__background-color);
  font-size: 16px;
  line-height: normal;
  color: var(--health-rate-button__rate-inactive-color);
  cursor: pointer;

  &.hover {
    border: solid 1px var(--health-rate-button__active-border-color);
    background-color: var(--health-rate-button__active-background-color);
  }

  &.active {
    border: solid 2px var(--health-rate-button__active-border-color);
    background-color: var(--health-rate-button__active-background-color);
    box-shadow: var(--health-rate-button__active-box_shadow);
    color: var(--health-rate-button__rate-active-color);
  }

  &:not(:first-child) {
    margin-left: 14px;
  }
}
</style>