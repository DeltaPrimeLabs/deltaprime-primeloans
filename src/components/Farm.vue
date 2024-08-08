<template>
  <div class="stake-beta-component">

    <div class="total-value-wrapper">
      <NameValueBadgeBeta class="total-value" :name="'Total value'">
        {{ (fullLoanStatus.totalValue ? fullLoanStatus.totalValue : 0) | usd }}
      </NameValueBadgeBeta>
    </div>

    <div class="filters">
      <div class="filter-container">
        <div class="filter__label">Filter by assets:</div>
        <AssetFilter ref="assetFilter" :asset-filter-groups="assetFilterGroups" v-on:filterChange="setFilter"></AssetFilter>
      </div>
    </div>
    <StakingAssetBeta v-for="asset in filteredStakedAssets"
                      v-bind:key="asset[0]"
                      :assetSymbol="asset[0]"
                      :farmingConfig="asset[1]">
    </StakingAssetBeta>
    <StakingAssetBetaWombatYY v-for="farm in filteredWombatYYFarms" :farm="farm" v-bind:key="farm.apyKey"></StakingAssetBetaWombatYY>
  </div>
</template>

<script>
import StakingAssetBeta from './StakingAssetBeta';
import config from '../config';
import AssetFilter from './AssetFilter';
import {mapActions, mapState} from 'vuex';
import NameValueBadgeBeta from './NameValueBadgeBeta';
import StakingAssetBetaWombatYY from "./StakingAssetBetaWombatYY.vue";

export default {
  name: 'Farm',
  components: {StakingAssetBetaWombatYY, StakingAssetBeta, AssetFilter, NameValueBadgeBeta},
  computed: {
    ...mapState('fundsStore', ['fullLoanStatus']),
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
    filteredWombatYYFarms() {
      return config.WOMBAT_YY_FARMS.filter(farm => this.selectedAssets.includes(farm.assetToken));
    },
  },
  mounted() {
    this.setupAssetFilterGroups();
  },
  data() {
    return {
      selectedAssets: [] = [],
      assetsFilterOptions: [] = [],
      assetFilterGroups: null,
    };
  },
  methods: {
    ...mapActions('stakeStore', ['updateStakedBalances']),
    setFilter(filter) {
      this.selectedAssets = filter.asset;
    },
    setupAssetFilterGroups() {
      this.assetFilterGroups = [
        {
          label: 'Filter by assets',
          options: [...Object.entries(config.FARMED_TOKENS_CONFIG).filter(([,value]) => !value[0].isTokenLp).map(el => el[0]), 'ggAVAX'],
          key: 'asset'
        },
      ];

      this.selectedLpTokens = this.assetFilterGroups[0].options;
      setTimeout(() => {
        this.$refs.assetFilter.assetFilterGroups = this.assetFilterGroups;
        this.$refs.assetFilter.setupFilterValue();
        this.selectedAssets = this.assetFilterGroups[0].options;
      });
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.stake-beta-component {
  width: 100%;
}

.total-value-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  margin-bottom: 57px;
  margin-top: 23px;
}

.filters {
  margin-bottom: 10px;
}

</style>
