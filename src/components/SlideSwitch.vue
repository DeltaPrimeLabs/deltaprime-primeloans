<template>
  <div class="slide-switch" v-bind:class="{ 'slide-switch-on': value }" @click="onSlideChange">
    <div class="slide-switch__indicator"></div>
  </div>
</template>

<script>
export default {
  name: "SlideSwitch",
  props: {
    value: Boolean
  },
  methods: {
    onSlideChange() {
      this.$emit('update:value', !this.value);
    },
  },
}
</script>

<style scoped>

.slide-switch {
  position: relative;
  height: 21px;
  width: 38px;
  background: var(--slide-switch__background-color--off);
  border-radius: 999px;
  transition: background 200ms ease-in-out;
  cursor: pointer;

  &.slide-switch-on {
    background: var(--slide-switch__background-color--on);

    .slide-switch__indicator {
      right: 2px;
      box-shadow: var(--slide-switch__indicator-box-shadow);
      background: var(--slide-switch__indicator-color--on);
    }
  }

  .slide-switch__indicator {
    position: absolute;
    top: 2px;
    right: 19px;
    transition: right 200ms ease-in-out;
  }
}

.slide-switch__indicator {
  background: var(--slide-switch__indicator-color--off);
  height: 17px;
  width: 17px;
  border-radius: 50%;
}

</style>
