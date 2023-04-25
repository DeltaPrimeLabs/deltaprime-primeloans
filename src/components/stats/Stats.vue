<template>
  <StatsSharesSection></StatsSharesSection>
</template>

<script>
import PieChart from "./PieChart.vue";
import StatsSection from "./StatsSection.vue";
import StatsSharesSection from "./StatsSharesSection.vue";

export default {
  name: "Stats",
  components: {StatsSharesSection, StatsSection, PieChart}
}
</script>

<style scoped lang="scss">
.pie-chart-section {
  width: 400px;
  position: relative;
}

</style>
