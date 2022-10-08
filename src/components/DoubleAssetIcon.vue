<template>
  <div class="double-asset-icon-component">
    <div class="double-icon">
      <div class="icon icon__primary">
        <img class="icon__img" :src="logoSrc(primary)">
      </div>
      <div class="icon icon__secondary">
        <img class="icon__img" :src="logoSrc(secondary)">
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DoubleAssetIcon',
  props: {
    primary: null,
    secondary: null,
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.double-asset-icon-component {
  display: flex;

  .double-icon {
    display: flex;
    flex-direction: row;

    .icon {
      width: 22px;
      height: 22px;
      border-radius: 22px;

      &.icon__primary {
        width: 24px;
        height: 24px;
        border: 1px solid white;
      }

      &.icon__secondary {
        margin-left: -5px;
        margin-top: 1px;
      }

      .icon__img {
        width: 22px;
        height: 22px;
      }
    }
  }
}

</style>