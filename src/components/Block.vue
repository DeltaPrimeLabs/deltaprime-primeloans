<template>
  <div class="block-wrapper" :class="{ bordered }">
    <slot></slot>
  </div>
</template>


<script>
  export default {
    name: 'Block',
    props: {
      bordered: false,
      background: {
        type: String,
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.block-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 35px;
  background: var(--block__background-color);
  padding-bottom: 50px;
}

.block-wrapper.bordered {
  position: relative;
  background-clip: padding-box;
  border-radius: 35px;
}

.block-wrapper.bordered::after {
  position: absolute;
  top: -4px;
  bottom: -4px;
  left: -4px;
  right: -4px;
  background-image: var(--block__border-image);
  content: '';
  z-index: -1;
  border-radius: 38px;
  box-shadow: var(--block__box-shadow);
}

</style>

