<template>
  <div class="stake-beta-component">
    <StakingAssetBeta></StakingAssetBeta>
    <StakingAssetBeta></StakingAssetBeta>
    <StakingAssetBeta></StakingAssetBeta>
  </div>
</template>

<script>
import StakingAssetBeta from './StakingAssetBeta';
export default {
  name: 'StakeBeta',
  components: {StakingAssetBeta}
};
</script>

<style lang="scss" scoped>

.stake-beta-component {
  width: 100%;
}

</style>