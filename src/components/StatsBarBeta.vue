<template>
  <div class="stats-bar-beta-component">
    <div class="stats-bar">
      <stats-bar-element-beta
        :label="'Borrowed'"
        :value="debt ? debt : 0 | usd"
        :info-tooltip="`The value of your borrowed assets.`
      ">
      </stats-bar-element-beta>
      <div class="stats-bar__divider"></div>
      <div class="health-loader-container" v-if="noSmartLoan === null || healthLoading">
        <vue-loaders-ball-beat color="#A6A3FF" scale="1"></vue-loaders-ball-beat>
      </div>
      <stats-bar-element-beta
          v-if="noSmartLoan !== null && health != null && !healthLoading"
          :label="'Health'"
          :value="health | percent"
          :info-tooltip="`How far you are from liquidation, on a scale from 100% to 0%.`
          ">
        <div class="bar-gauge-container">
          <bar-gauge-beta :min="0" :max="1" :value="health"></bar-gauge-beta>
        </div>
      </stats-bar-element-beta>

      <div class="stats-bar__divider"></div>

      <stats-bar-element-beta
          :label="'Collateral'"
          :value="collateral ? collateral : 0 | usd"
          :info-tooltip="`The total value of all your assets, minus the value of your borrowed assets. <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/exchange#borrowed' target='_blank'>More information</a>.`">
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
    collateral: null,
    health: null,
    noSmartLoan: null,
    healthLoading: false,
  },
  computed: {
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.stats-bar-beta-component {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  .stats-bar {
    width: 880px;
    height: 100px;
    border-radius: 50px;
    box-shadow: var(--stats-bar-beta__box-shadow);
    background-color: var(--stats-bar-beta__background);
    font-weight: 500;
    display: flex;
    flex-direction: row;
    align-items: start;
    justify-content: space-between;
    padding: 22px 0 24px 0;

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
      width: 292px;
      margin-top: -10px;
    }

    .stats-bar__divider {
      height: 60px;
      width: 2px;
      background: var(--stats-bar-beta__divider-background);
      border-radius: 1px;
    }

    .bar-gauge-container {
      margin-top: 9px;
      margin-right: 10px;
    }
  }
}
</style>
