<template>
  <div class="flat-button-component" v-on:click="buttonClick()">
    <slot></slot>
    <img v-if="tooltip"
         class="info__icon"
         src="src/assets/icons/info.svg"
         v-tooltip="{content: tooltip, classes: 'info-tooltip long', placement: 'right'}">
  </div>
</template>

<script>
export default {
  name: 'FlatButton',
  props: {
    tooltip: null,
  },
  methods: {
    buttonClick() {
      this.$emit('buttonClick', null);
    },
  }
};
</script>

<style scoped lang="scss">
@import "~@/styles/variables";

.flat-button-component {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  flex-wrap: nowrap;
  align-items: center;
  padding: 2px 8px;
  margin: 0 18px 0 5px;
  border-radius: 10px;
  border: solid 1px $delta-accent;
  text-transform: uppercase;
  font-size: $font-size-xs;
  color: $delta-tertiary;
  font-weight: bold;
  cursor: pointer;
  user-select: none;

  &:hover {
    background-color: $delta-light;
    color: $persian-blue;
  }

  .info__icon {
    margin-left: 5px;
  }
}

</style>