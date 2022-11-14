<template>
  <div class="stats-bar-beta-component">
    <div class="stats-bar">
      <stats-bar-element-beta :label="'Total value'" :value="totalValue ? totalValue : 0 | usd">
      </stats-bar-element-beta>
      <div class="health-loader-container" v-if="noSmartLoan === null">
        <vue-loaders-ball-beat color="#A6A3FF" scale="1"></vue-loaders-ball-beat>
      </div>
      <stats-bar-element-beta v-if="noSmartLoan !== null && health != null" :label="'Health'" :value="health | percent">
        <bar-gauge-beta :min="0" :max="1" :value="health"></bar-gauge-beta>
      </stats-bar-element-beta>

      <vue-loaders-ball-beat v-if="health == null" color="#A6A3FF" scale="1"></vue-loaders-ball-beat>

      <stats-bar-element-beta :label="'Borrowed'" :value="debt ? debt : 0 | usd">
      </stats-bar-element-beta>
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
    health: null,
    noSmartLoan: null,
  },
  computed: {
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

  .total-value-extra {
    font-size: $font-size-sm;
    margin-bottom: 19px;
  }

  .health-loader-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    height: 92px;
  }
}
</style>