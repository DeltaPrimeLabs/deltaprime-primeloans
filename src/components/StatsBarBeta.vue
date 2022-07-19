<template>
  <div class="stats-bar-beta-component">
    <div class="stats-bar">
      <stats-bar-element-beta :label="'Total value'" :value="avaxToUSD(8) | usd">
        <div class="total-value-extra">
          Today: <colored-value-beta :value="23.45" :formatting="'usd'"></colored-value-beta>
        </div>
      </stats-bar-element-beta>
      <stats-bar-element-beta v-if="ltv" :label="'LTV'" :value="ltv | percent">
        <bar-gauge-beta :min="0" :max="5" :value="ltv"></bar-gauge-beta>
      </stats-bar-element-beta>

      <vue-loaders-ball-beat v-if="!ltv" color="#A6A3FF" scale="1"></vue-loaders-ball-beat>


      <stats-bar-element-beta :label="'Profit'" :value="12.56 | usd">
        <div class="profit-extra">
          <colored-value-beta :value="0.1593" :formatting="'percent'"></colored-value-beta>
        </div>
      </stats-bar-element-beta>
    </div>
  </div>
</template>

<script>
import Bar from './Bar';
import StatsBarElementBeta from './StatsBarElementBeta';
import BarGaugeBeta from './BarGaugeBeta';
import ColoredValueBeta from './ColoredValueBeta';

export default {
  name: 'StatsBarBeta',
  components: {ColoredValueBeta, BarGaugeBeta, StatsBarElementBeta},
  props: {
    totalValue: null,
    todayPNL: null,
    ltv: null,
    profit: null,
    profitPercentage: null,
  },
  comments: {
    Bar
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
  align-items: center;
  justify-content: space-between;
  padding: 16px 210px 16px 210px;

  .total-value-extra, .profit-extra {
    font-size: $font-size-md;
    margin-bottom: 19px;
  }
}
</style>