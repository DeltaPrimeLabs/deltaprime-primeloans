<template>
  <div class="zaps">
    <div class="zaps__header">
      Choose your strategy:
    </div>
    <div class="zaps__tiles">
      <ZapLong></ZapLong>
      <ZapShort></ZapShort>
    </div>
  </div>
</template>

<script>

import ZapLong from "./zaps-tiles/ZapLong.vue";
import ZapShort from './zaps-tiles/ZapShort.vue';

export default {
  name: "Zaps",
  components: {ZapLong, ZapShort}
}
</script>

<style scoped>

.zaps {
  width: 100%;
  padding: 16px 48px;
}

.zaps__header {
  font-size: 18px;
  color: var(--zaps__header-color);
  margin-bottom: 32px;
  text-align: center;
}

.zaps__tiles {
  width: 80%;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 16px;
}
</style>
