<template>
  <div class="zaps">
    <img src="src/assets/images/zaps-background-gradient.png" class="zaps__gradient">
    <img src="src/assets/images/zaps-background-gradient--dark.png" class="zaps__gradient zaps__gradient--dark">
    <div class="zaps__header">
      Choose your strategy:
    </div>
    <div class="zaps__tiles">
      <ZapCreateAccount v-if="!hasSmartLoanContract"></ZapCreateAccount>
      <ZapLong></ZapLong>
      <ZapShort></ZapShort>
      <ZapConvertGlpToGm></ZapConvertGlpToGm>
    </div>
  </div>
</template>

<script>

import ZapLong from "./zaps-tiles/ZapLong.vue";
import ZapShort from './zaps-tiles/ZapShort.vue';
import ZapCreateAccount from "./zaps-tiles/ZapCreateAccount.vue";
import {mapState} from "vuex";
import ZapConvertGlpToGm from "./zaps-tiles/ZapConvertGlpToGm.vue";

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: "Zaps",
  components: {ZapConvertGlpToGm, ZapCreateAccount, ZapLong, ZapShort},
  computed: {
    ...mapState('fundsStore', [
      'smartLoanContract',
    ]),
    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },
  }
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
  width: 910px;
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
