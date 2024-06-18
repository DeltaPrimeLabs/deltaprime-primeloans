<template>
  <div class="bar-gauge-beta-component" v-bind:class="{'bar-gauge-beta-component--inline': displayInline}">
    <div class="bar-gauge">
      <div class="bar" v-bind:class="{'bar--slim': slim, 'bar--zero': value === 0}">
        <div v-if="value > 0" class="bar__value" v-bind:class="{'bar__value--completion': value >= max && greenOnCompletion}" :style="{'width': barGaugeValueWidth + 'px'}"></div>
      </div>
      <div v-if="!slim && min && max" class="range">
        <div>{{min | percent(0)}}</div>
        <div>{{max | percent(0)}}</div>
      </div>
    </div>
  </div>
</template>

<script>
const BAR_GAUGE_WIDTH = 108;
const SLIM_BAR_GAUGE_WIDTH = 53;

export default {
  name: 'BarGaugeBeta',
  props: {
    min: {
      type: Number,
      required: true,
    },
    max: {
      type: Number,
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    width: {
      type: Number,
      required: false,
    },
    slim: {
      type: Boolean,
      default: false,
    },
    displayInline: {
      type: Boolean,
      default: false,
    },
    greenOnCompletion: {
      type: Boolean,
      default: false,
    }
  },
  computed: {
    barGaugeElementWidth() {
      return this.width ? this.width : this.slim ? SLIM_BAR_GAUGE_WIDTH : BAR_GAUGE_WIDTH;
    },
    barGaugeValueWidth() {
      if (this.value < this.min) {
        return 0
      } else if (this.value > this.max) {
        return this.barGaugeElementWidth;
      } else {
        return this.barGaugeElementWidth * ((this.value - this.min) / (this.max - this.min));
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.bar-gauge-beta-component {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  &.bar-gauge-beta-component--inline {
    display: inline-flex;
  }

  .bar-gauge {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .bar {
      position: relative;
      width: 108px;
      height: 17px;
      border-radius: 9.5px;
      box-shadow: var(--bar__box-shadow);
      background-color: var(--bar__background-color);

      &.bar--slim {
        width: 53px;
        height: 11px;

        .bar__value {
          height: 11px;
          min-width: 11px;
        }
      }

      &.bar--zero {
        box-shadow: inset 0 1px 3px 0 rgba(246, 66, 84, 0.3);
        background-color: rgba(255, 105, 105, 0.2);
      }

      .bar__value {
        top: 0;
        left: 0;
        width: 30px;
        min-width: 17px;
        height: 17px;
        border-radius: 9.5px;
        background-image: var(--bar__value-background-image);

        &.bar__value--error {
          background-image: none;
          background-color: var(--bar__value-background-image--error);
        }

        &.bar__value--completion {
          background-image: var(--bar__value-background-image--completion);
        }
      }
    }

    .range {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      margin-top: 2px;
      color: $steel-gray;
      font-size: $font-size-xxs;
    }
  }
}

</style>
