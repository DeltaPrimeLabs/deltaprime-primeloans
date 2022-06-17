<template>
  <span class="colored-value-component">
    <span class="colored-value" v-bind:class="{ positive: value > 0, negative: value < 0 }">
      <span class="plus-sign" v-if="value > 0">+</span>
      {{ formattedValue }}
    </span>
  </span>
</template>

<script>
export default {
  name: 'ColoredValueBeta',

  props: {
    formatting: {
      type: String,
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    percentageRoundingPrecision: {
      type: Number,
      required: false,
      default: 3,
    }
  },
  computed: {
    formattedValue() {
      switch (this.formatting) {
        case 'usd':
          return this.$options.filters.usd(this.value);
        case 'percent':
          return this.$options.filters.percent(this.value, this.percentageRoundingPrecision);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.colored-value {
  &.positive {
    color: $lime-green;
  }

  &.negative {
    color: $red;
  }

  .plus-sign {
    margin-right: -3px;
  }
}

</style>