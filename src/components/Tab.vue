<template>
  <div class='tab'>
    <slot></slot>
  </div>
</template>

<script>
export default {
  props: {
    title: {
      type: String,
      default: 'Tab'
    },
    tabIcon: String,
    tabIconSlim: String,
    imgPosition: String,
    titleWidth: String
  },
  data () {
    return {
      isActive: true
    }
  }
}
</script>

<style lang="scss">
@import "~@/styles/variables";

.tab {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 1126px;
  margin: 20px 52px 0 52px;
  flex-grow: 0;
  flex-shrink: 0;
  transition: all 200ms ease-in-out;

  @media screen and (min-width: $md) {
    margin-top: 0;
  }
}
</style>
