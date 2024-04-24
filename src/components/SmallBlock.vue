<template>
  <div class="small-block-wrapper">
    <div class="small-block">
      <DeltaIcon class="cross clickable-icon" :icon-src="'src/assets/icons/cross.svg'" :size="22" @click.native="onClose"></DeltaIcon>
      <slot />
    </div>
  </div>
</template>

<script>
import DeltaIcon from "./DeltaIcon.vue";

export default {
  name: "SmallBlock",
  components: {DeltaIcon},
  methods: {
    onClose() {
      this.$emit('close',true);
    }
  }
}
</script>

<style scoped lang="scss">
.small-block-wrapper {
  background-image: var(--small-block__small-block-wrapper-background);
  border-radius: 25px;
  padding: 2px;
  box-shadow: var(--small-block__small-block-wrapper-box-shadow);
  height: 100%;

  .small-block {
    display: flex;
    flex-direction: column;
    background: var(--small-block__small-block-background);
    padding: 16px 16px;
    border-radius: 23px;
    height: 100%;

    .cross {
      align-self: flex-end;
      flex-shrink: 0;
      background: var(--small-block__cross-color);

      &:hover {
        background: var(--small-block__cross-color--hover);
      }
    }
  }
}
</style>
