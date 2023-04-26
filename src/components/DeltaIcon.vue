<template>
  <div ref="icon" class="delta-icon" v-bind:class="{'delta-icon--no-hover': noHover}" v-bind:style="`height: ${$props.size}px; width: ${$props.size}px`"></div>
</template>

<script>
export default {
  name: "DeltaIcon",
  props: {
    size: {
      type: Number,
      default: 24
    },
    iconSrc: {
      type: String,
      default: ''
    },
    noHover: {
      type: Boolean,
      default: false,
    }
  },
  mounted() {
    this.$refs.icon.style.webkitMaskImage = `url(${this.iconSrc})`;
    this.$refs.icon.style.maskImage = `url(${this.iconSrc})`;
  }
}
</script>

<style scoped lang="scss">
.delta-icon {
  display: inline-block;
  vertical-align: middle;
  -webkit-mask-size: contain;
  mask-size: cover;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;

  &.delta-icon--no-hover {
    pointer-events: none;
  }
}
</style>
