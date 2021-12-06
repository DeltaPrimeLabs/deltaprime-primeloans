<template>
  <div class="small-block-wrapper">
    <div class="small-block">
      <img src="src/assets/icons/cross.svg" class="cross" @click="onClose"/>
      <slot />
    </div>
  </div>
</template>

<script>
export default {
  name: "SmallBlock",
  methods: {
    onClose() {
      this.$emit('close',true);
    }
  }
}
</script>

<style scoped lang="scss">
.small-block-wrapper {
  background-image: linear-gradient(117deg, #dfe0ff 39%, #ffe1c2 62%, #ffd3e0 82%);
  border-radius: 25px;
  padding: 2px;
  box-shadow: 4px 4px 14px 0 rgba(191, 188, 255, 0.25);

  .small-block {
    display: flex;
    flex-direction: column;
    background: white;
    padding: 16px 16px;
    border-radius: 23px;
    height: 100%;

    img {
      align-self: flex-end;
      cursor: pointer;
    }
  }
}
</style>
