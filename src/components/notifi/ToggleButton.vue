<template>
  <div
    :class="['toggle-button', toggled ? 'toggle-on' : '']"
    @click="handleClick"
  >
    <div class="toggle-button__switch">
    </div>
  </div>
</template>
  
<script>
export default {
  name: "ThemeToggle",
  components: {},
  created() {
  },
  data() {
    return {
      toggled: false
    }
  },
  methods: {
    handleClick() {
      toggled = !toggled;
      this.$emit('alertToggle', toggled);
    },
  }
}
</script>
  
<style scoped lang="scss">
@import "~@/styles/variables";

.toggle-button {
  position: relative;
  height: 21px;
  width: 38px;
  background: var(--toggle-button__background);
  border-radius: 999px;
  cursor: pointer;
  user-select: none;

  &.toggle-on {
    background: var(--toggle-button__toggle-on-background);

    .toggle-button__switch{
      left: 19px;
      background: var(--toggle-button__switch-on-background);
    }
  }
}

.toggle-button__switch {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 17px;
  height: 17px;
  border-radius: 999px;
  box-shadow: var(--toggle-button__switch-box-shadow);
  background: var(--toggle-button__switch-background);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: left 200ms ease-in-out;
}

</style>
