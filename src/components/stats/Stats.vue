<template>
  <div id="stats-container" class="stats-container">
    <StatsChartSection class="stats-chart-section"></StatsChartSection>
    <StatsSharesSection class="stats-shares-section"></StatsSharesSection>
    <TransactionHistory class="transaction-history"></TransactionHistory>
  </div>
</template>

<script>
import PieChart from "./PieChart.vue";
import StatsSection from "./StatsSection.vue";
import StatsSharesSection from "./StatsSharesSection.vue";
import TransactionHistory from '../TransactionHistory';
import StatsChartSection from "./StatsChartSection.vue";

export default {
  name: "Stats",
  components: {StatsChartSection, TransactionHistory, StatsSharesSection, StatsSection, PieChart}
}
</script>

<style scoped lang="scss">
.stats-container {
  box-sizing: border-box;
  height: 1706px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-column-gap: 20px;
  grid-row-gap: 20px;
  width: 100%;
  padding-top: 30px;

  .stats-chart-section {
    grid-area: 1 / 1 / 2 / 4;
    height: 424px;
  }

  .stats-shares-section {
    grid-area: 2 / 1 / 3 / 4;
  }

  .transaction-history {
    grid-area: 3 / 1 / 4 / 4;
  }
}

</style>
