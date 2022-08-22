<template>
  <div class="stake-beta-component">
    <StakingAssetBeta v-for="asset in assetsAvailableForStaking"
                      v-bind:key="asset"
                      :stakingOptions="stakedAssets[asset]"
                      :assetSymbol="asset">
    </StakingAssetBeta>
  </div>
</template>

<script>
import StakingAssetBeta from './StakingAssetBeta';
import {mapActions, mapGetters, mapState} from 'vuex';

export default {
  name: 'StakeBeta',
  components: {StakingAssetBeta},
  data() {
    return {
      assetsAvailableForStaking: null,
    };
  },
  computed: {
    ...mapState('stakeStore', ['stakedAssets'])
  },
  methods: {
    ...mapActions('stakeStore', ['setup']),
    setupStakedAssets(stakedAssets) {
      if (stakedAssets) {
        this.assetsAvailableForStaking = Object.keys(stakedAssets);
      }
    }
  },
  mounted() {
  },

  watch: {
    stakedAssets: {
      handler(stakedAssets) {
        this.setupStakedAssets(stakedAssets);
      },
      immediate: true
    }
  }
};
</script>

<style lang="scss" scoped>

.stake-beta-component {
  width: 100%;
}

</style>