<template>
  <div class="stats-bar-element-beta-component">
    <div class="stat">
      <div class="stat__label">{{label}}</div>
      <div class="stat__value">{{value}}</div>
      <div class="stat__extras">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StatsBarElementBeta',

  props: {
    label: {
      type: String,
      required: true,
    },
    value: {
      type: String,
      required: true,
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
    }

    .stat__extras {
      margin-top: 5px;
    }

  }
</style>