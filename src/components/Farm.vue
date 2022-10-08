<template>
  <div class="stake-beta-component">
    <StakingAssetBeta v-for="asset in stakedAssets"
                      v-bind:key="asset[0]"
                      :assetSymbol="asset[0]"
                      :farmingConfig="asset[1]">
    </StakingAssetBeta>
  </div>
</template>

<script>
import StakingAssetBeta from './StakingAssetBeta';
import config from "../config";

export default {
  name: 'Farm',
  components: {StakingAssetBeta},
  data() {
  },
  computed: {
    stakedAssets() {
      return Object.entries(config.FARMED_TOKENS_CONFIG);
    }
  },
  methods: {
  },
  mounted() {
  },

  watch: {
  }
};
</script>

<style lang="scss" scoped>

.stake-beta-component {
  width: 100%;
}

</style>