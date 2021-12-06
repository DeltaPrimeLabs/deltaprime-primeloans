<template>
  <div class="block-wrapper" :style="{ background }" :class="{ bordered }">
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
        default: 'white'
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
  border-radius: 21px;
  box-shadow: 7px 7px 30px 0 rgba(191, 188, 255, 0.5);
  padding: 1.5rem;

  @media screen and (min-width: $md) {
    padding: 40px 54px;
  }
}

.block-wrapper.bordered {
  position: relative;
  background-clip: padding-box;
}

.block-wrapper.bordered::after {
  position: absolute;
  top: -4px; bottom: -4px;
  left: -4px; right: -4px;
  background: linear-gradient(148deg, #c9cbff 21%, #ffd8b1 60%, #fcb7cc 94%);
  content: '';
  z-index: -1;
  border-radius: 25px;
}

</style>

