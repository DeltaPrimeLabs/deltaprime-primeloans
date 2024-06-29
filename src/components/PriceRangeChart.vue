<template>
  <div class="price-range-chart__wrapper">
    <div class="price-range-chart">
      <div class="price-range-chart__range" v-bind:style="`left: ${rangeLeft}%; right: ${rangeRight}%`">
        <div class="price-range-chart__range-tick price-range-chart__range-tick--start">{{ rangeStart.toFixed(2) }}</div>
        <div class="price-range-chart__range-tick price-range-chart__range-tick--end">{{ rangeEnd.toFixed(2) }}</div>
      </div>
      <div class="price-range-chart__active-label" v-bind:style="`left: ${activeLeft}%`">
        Active<br>${{ activeValue ? activeValue.toFixed(2) : 0 }}
      </div>
      <div class="price-range-chart__active-line" v-bind:style="`left: ${activeLeft}%`"></div>
    </div>
    <div class="price-range-chart__border"></div>
  </div>
</template>

<script>

import FlatButton from './FlatButton.vue';
import DoubleAssetIcon from './DoubleAssetIcon.vue';
import DistributionChart from "./DistributionChart.vue";
import DeltaIcon from "./DeltaIcon.vue";
import InfoIcon from "./InfoIcon.vue";
import {mapState} from "vuex";

const ethers = require('ethers');

export default {
  name: 'PriceRangeChart',
  components: {InfoIcon, DeltaIcon, DoubleAssetIcon, DistributionChart, FlatButton},
  props: {
    axisStart: null,
    axisEnd: null,
    rangeStart: null,
    rangeEnd: null,
    activeValue: null,
  },
  data() {
    return {};
  },
  computed: {
    rangeLeft() {
      return (this.rangeStart - this.axisStart) / (this.axisEnd - this.axisStart) * 100;
    },
    rangeRight() {
      return 100 - (this.rangeEnd - this.axisStart) / (this.axisEnd - this.axisStart) * 100;
    },
    activeLeft() {
      return (this.activeValue - this.axisStart) / (this.axisEnd - this.axisStart) * 100;
    }
  },
  mounted() {
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.price-range-chart {
  position: relative;
  width: calc(100% - 46px);
  height: 100%;
  margin: 0 23px;

  &__wrapper {
    width: 280px;
    height: 147px;
    display: flex;
    flex-direction: column;
    margin-bottom: 24px;
  }

  &__border {
    height: 2px;
    width: calc(100% - 6px);
    margin: 0 3px;
    background: var(--price-range-chart__border);
  }

  &__range {
    position: absolute;
    top: 50%;
    bottom: 0;
    background: var(--price-range-chart__range-background);
  }

  &__range-tick {
    $tick-translate-y: translateY(calc(100% + 4px));
    position: absolute;
    bottom: 0;
    font-size: 12px;
    color: var(--price-range-chart__tick-color);

    &--start {
      transform: $tick-translate-y translateX(-50%);
      left: 0;
    }

    &--end {
      transform: $tick-translate-y translateX(50%);
      right: 0;
    }
  }

  &__active-line {
    position: absolute;
    width: 2px;
    top: 50px;
    bottom: 0;
    background: var(--price-range-chart__active-line-color);
  }

  &__active-label {
    position: absolute;
    top: 50px;
    transform: translate(-50%, calc(-100% - 4px));
    text-align: center;
    color: var(--price-range-chart__tick-color);
  }
}
</style>
