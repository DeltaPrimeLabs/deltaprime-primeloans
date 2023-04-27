<template>
  <div class="stats-container">
    <StatsSharesSection class="stats-shares-section"></StatsSharesSection>
    <TransactionHistory class="transaction-history"></TransactionHistory>
  </div>
</template>

<script>
import PieChart from "./PieChart.vue";
import StatsSection from "./StatsSection.vue";
import StatsSharesSection from "./StatsSharesSection.vue";
import TransactionHistory from '../TransactionHistory';

export default {
  name: "Stats",
  components: {TransactionHistory, StatsSharesSection, StatsSection, PieChart}
}
</script>

<style scoped lang="scss">
.stats-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-column-gap: 20px;
  grid-row-gap: 20px;
  width: 100%;
  margin-top: 30px;

  .stats-shares-section {
    grid-area: 1 / 1 / 2 / 4;
  }

  .transaction-history {
    grid-area: 2 / 1 / 3 / 4;
  }
}

</style>
