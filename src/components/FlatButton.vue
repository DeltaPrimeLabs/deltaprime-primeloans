<template>
  <div class="flat-button-component" v-on:click="buttonClick()">
    <slot></slot>
    <InfoIcon
        v-if="tooltip"
        class="info__icon"
        :tooltip="{ content: tooltip, classes: 'info-tooltip long', placement: 'right' }"
        :classes="'info-tooltip'"
    ></InfoIcon>
  </div>
</template>

<script>
import InfoIcon from "./InfoIcon.vue";

export default {
  name: 'FlatButton',
  components: {InfoIcon},
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
  border: solid 1px var(--flat-button__border-color);
  text-transform: uppercase;
  font-size: $font-size-xs;
  color: var(--flat-button__color);
  font-weight: bold;
  cursor: pointer;
  user-select: none;

  &:hover {
    background-color: var(--flat-button__background-color--hover);
    color: var(--flat-button__color--hover);
  }

  .info__icon {
    margin-left: 5px;
  }
}

</style>
