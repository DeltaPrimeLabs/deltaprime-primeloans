<template>
  <div class="wombat-pool-row">
    <div class="wombat-pool-row__header-wrapper">
      <div class="wombat-pool-row__header-line"></div>
      <div class="wombat-pool-row__header">
        {{ poolName }} Pool
      </div>
    </div>
    <div class="wombat-pool-row__tokens">
      <WombatLpTableRow v-for="(token, index) in tokens" v-bind:key="index" :lpToken="token" :last="last && index === tokens.length - 1"></WombatLpTableRow>
    </div>
  </div>
</template>

<script>
import WombatLpTableRow from "./WombatLpTableRow.vue";

export default {
  name: 'WombatPoolRow',
  components: {WombatLpTableRow},
  props: {
    tokens: null,
    poolName: null,
    last: null,
  }
}
</script>

<style scoped lang="scss">
.wombat-pool-row {
  display: flex;
  flex-direction: column;

  .wombat-pool-row__header-wrapper {
    position: relative;
    margin-top: 8px;
  }

  .wombat-pool-row__header-line {
    height: 2px;
    width: 100%;
    margin: 9px 0;
    background: var(--wombat-pool-row__header-border);
  }

  .wombat-pool-row__header {
    color: var(--wombat-pool-row__header-color);
    font-weight: 700;
    position: absolute;
    top: 0;
    left: 4%;
    padding: 0 16px;
    background: var(--block__background-color);
  }

  .wombat-pool-row__tokens {
    display: flex;
    flex-direction: column;
  }
}
</style>
