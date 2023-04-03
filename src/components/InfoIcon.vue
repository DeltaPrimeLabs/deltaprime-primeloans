<template>
  <DeltaIcon
      class="info-icon"
      :icon-src="'src/assets/icons/info.svg'"
      :size="$props.size"
      v-tooltip="$props.tooltip"

  ></DeltaIcon>
</template>

<script>
import DeltaIcon from "./DeltaIcon.vue";

export default {
  name: "InfoIcon",
  components: {DeltaIcon},
  props: {
    size: {
      type: Number,
      default: 16
    },
    tooltip: {
      type: Object,
      default: () => {}
    },
    classes: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped lang="scss">
.info-icon {
  background-image: var(--info-icon__background);
}

</style>
