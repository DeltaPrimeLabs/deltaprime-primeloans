<template>
  <div class="stats-bar-element-beta-component">
    <div class="stat">
      <div class="stat__label">{{label}}</div>
      <div class="stat__value" v-bind:class="{'stat__value--zero': value === '0.00%'}">
        <LoadedValue :check="() => value !== null" :value="value"></LoadedValue>
      </div>
      <div class="stat__extras">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script>
import LoadedValue from './LoadedValue';
export default {
  name: 'StatsBarElementBeta',
  components: {LoadedValue},
  props: {
    label: {
      type: String,
      required: true,
    },
    value: null,
    redIfZero: {
      type: Boolean,
      default: false
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .stat__label {
      font-size: $font-size-sm;
      font-weight: 500;
      color: $dark-gray;
    }

    .stat__value {
      margin-top: 8px;
      font-size: $font-size-mlg;

      &.stat__value--zero {
        color: $red;
        font-weight: 600;
      }
    }

    .stat__extras {
      margin-top: 5px;
    }

  }
</style>