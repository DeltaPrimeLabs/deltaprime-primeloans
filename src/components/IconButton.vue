<template>
  <div class="icon-button">
    <Bubble v-if="$slots.bubble">
      <slot name="bubble"></slot>
    </Bubble>
    <DeltaIcon :icon-src="$props.iconSrc" :size="$props.size"
               class="icon-button__icon"
               v-bind:class="{'icon-button__icon--disabled': $props.disabled || disabled}"
               v-on:click.native="onClick()">

    </DeltaIcon>
  </div>
</template>

<script>
import Bubble from "./Bubble.vue";
import DeltaIcon from "./DeltaIcon.vue";

export default {
  name: "IconButton",
  components: {DeltaIcon, Bubble},
  props: {
    size: {
      type: Number,
      default: 24
    },
    iconSrc: {
      type: String,
      default: ''
    },
    disabled: {
      type: Boolean,
      default: false
    },
  },
  methods: {
    onClick() {
      if (!this.disabled) {
        this.$emit('click', void 0);
      }
    }
  }
}
</script>

<style scoped lang="scss">
.icon-button__icon {
  cursor: pointer;
  background: var(--icon-button__icon-color--default);

  &:hover {
    background: var(--icon-button__icon-color-hover--default);
  }

  &.icon-button__icon--disabled {
    background: var(--icon-button__icon-color--disabled);
    cursor: default;
    pointer-events: none;
  }
}
</style>
