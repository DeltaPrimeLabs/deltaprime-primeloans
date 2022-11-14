<template>
  <div class="stake-beta-component">
    <div class="filters">
      <div class="filter-container">
        <div class="filter__label">Filter by assets:</div>
        <AssetFilter :asset-options="assetsFilterOptions" v-on:filterChange="selectAssets"></AssetFilter>
      </div>
    </div>
    <StakingAssetBeta v-for="asset in filteredStakedAssets"
                      v-bind:key="asset[0]"
                      :assetSymbol="asset[0]"
                      :farmingConfig="asset[1]">
    </StakingAssetBeta>
  </div>
</template>

<script>
import StakingAssetBeta from './StakingAssetBeta';
import config from '../config';
import AssetFilter from './AssetFilter';

export default {
  name: 'Farm',
  components: {StakingAssetBeta, AssetFilter},
  computed: {
    filteredStakedAssets() {
      return Object.entries(config.FARMED_TOKENS_CONFIG).filter(farm =>
          this.selectedAssets.includes(farm[0])
              || (config.LP_ASSETS_CONFIG[farm[0]] != null &&
                (this.selectedAssets.includes(config.LP_ASSETS_CONFIG[farm[0]].primary)
                || this.selectedAssets.includes(config.LP_ASSETS_CONFIG[farm[0]].secondary)
                )
              )
      );
    },
  },
  data() {
    return {
      selectedAssets: [] = [],
      assetsFilterOptions: [] = []
    }
  },
  methods: {
    setupAssetsFilterOptions() {
      this.assetsFilterOptions = ['AVAX', 'USDC', 'ETH', 'sAVAX'];
    },
    selectAssets(selectedTokens) {
      this.selectedAssets = selectedTokens;
    },
  },
  mounted() {
    this.setupAssetsFilterOptions();
    this.selectedAssets = this.assetsFilterOptions;
  },

  watch: {
  }
};
</script>

<style lang="scss" scoped>

.stake-beta-component {
  width: 100%;
}

.filters {
  margin-bottom: 10px;
}

</style>