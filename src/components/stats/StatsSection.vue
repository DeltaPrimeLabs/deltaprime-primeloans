<template>
  <div class="stats-section">
    <div class="stats-section__content">
      <slot></slot>
    </div>
  </div>
</template>

<script>
export default {
  name: "StatsSection"
}
</script>

<style scoped lang="scss">

.stats-section {
  position: relative;
}

.stats-section:before {
  position: absolute;
  top: -2px;
  bottom: -2px;
  left: -2px;
  right: -2px;
  background-image: var(--stats-section__border-image);
  content: '';
  border-radius: 26px;
}

.stats-section__content {
  position: relative;
  background: var(--stats-section__background);
  border-radius: 24px;
  height: 100%;
}
</style>
