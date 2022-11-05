<template>
  <div class="stats-bar-beta-component">
    <div class="stats-bar">

      <stats-bar-element-beta :label="'Borrowed'" :value="debt | usd">
        <div class="total-value-extra">
          Max: <colored-value-beta :value="borrowingCapacity" :formatting="'usd'"></colored-value-beta>
        </div>
      </stats-bar-element-beta>
      <stats-bar-element-beta v-if="ltv != null" :label="'Health Ratio'" :value="ltv | percent">
        <bar-gauge-beta :min="0" :max="5" :value="ltv"></bar-gauge-beta>
      </stats-bar-element-beta>

      <vue-loaders-ball-beat v-if="ltv == null" color="#A6A3FF" scale="1"></vue-loaders-ball-beat>

      <stats-bar-element-beta :label="'Collateral'" :value="totalValue - debt | usd"></stats-bar-element-beta>
    </div>
  </div>
</template>

<script>
import StatsBarElementBeta from './StatsBarElementBeta';
import BarGaugeBeta from './BarGaugeBeta';
import ColoredValueBeta from './ColoredValueBeta';
import config from "../config";

export default {
  name: 'StatsBarBeta',
  components: {ColoredValueBeta, BarGaugeBeta, StatsBarElementBeta},
  props: {
    totalValue: null,
    debt: null,
    ltv: null,
    profit: null,
    profitPercentage: null,
  },
  computed: {
    borrowingCapacity() {
      return config.MAX_ALLOWED_LTV * (this.totalValue - this.debt);
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.stats-bar {
  border-radius: 25px;
  box-shadow: 7px 7px 30px 0 rgba(191, 188, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.3);
  font-weight: 500;
  display: flex;
  flex-direction: row;
  align-items: start;
  justify-content: space-between;
  padding: 16px 210px 16px 210px;

  .total-value-extra, .profit-extra {
    font-size: $font-size-sm;
    margin-bottom: 19px;
  }
}
</style>