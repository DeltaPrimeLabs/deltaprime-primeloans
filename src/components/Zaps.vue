<template>
  <div class="zaps">
    <img src="src/assets/images/zaps-background-gradient.png" class="zaps__gradient">
    <img src="src/assets/images/zaps-background-gradient--dark.png" class="zaps__gradient zaps__gradient--dark">
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

<style scoped lang="scss">

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
  position: relative;
  width: 870px;
  margin: 0 auto;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: 30px;
}

.zaps__gradient {
  position: absolute;
  height: 100%;
  width: 100%;
  user-select: none;
  pointer-events: none;
  opacity: var(--show-light-opacity);

  &.zaps__gradient--dark {
    opacity: var(--show-dark-opacity);
  }
}
</style>
