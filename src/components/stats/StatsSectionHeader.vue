<template>
<div class="stats-section-header">
  <slot></slot>
</div>
</template>

<script>
export default {
  name: "StatsSectionHeader"
}
</script>

<style scoped lang="scss">
.stats-section-header {
  width: 100%;
  color: var(--stats-section-header__color);
  text-align: center;
  margin-bottom: 30px;
  font-size: 20px;
  font-weight: 500;
}
</style>
