<template>
  <div id="icon-button-menu-component" class="icon-button-menu-component" v-tooltip="!menuOpen && config.tooltip">
    <img id="icon-button" class="icon-button"
         :src="config.iconSrc"
         v-on:click="iconButtonClick()">
    <div class="menu" v-if="config.menuOptions && this.menuOpen">
      <div class="menu__option" v-for="option in config.menuOptions" v-bind:key="option.key"
           v-on:click="menuOptionClick(option)">
        {{ option.name }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'IconButtonMenuBeta',
  props: {
    config: {
      type: Object,
      required: true,
    }
  },
  mounted() {
    document.addEventListener('click', (event) => {
      if (!document.getElementById('icon-button-menu-component').contains(event.target) && event.target.id !== 'icon-button') {
        if (this.menuOpen) {
          this.menuOpen = false;
        }
      }
    });
  },
  data() {
    return {
      menuOpen: false,
    };
  },
  methods: {
    iconButtonClick() {
      if (this.config.menuOptions) {
        this.menuOpen = !this.menuOpen;
      } else {
        this.$emit('iconButtonClick', this.config.iconButtonActionKey);
      }
    },

    menuOptionClick(option) {
      this.$emit('menuOptionClick', option.key);
    }
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.icon-button-menu-component {
  position: relative;

  .icon-button {
    height: 26px;
    width: 26px;

    &:hover {
      cursor: pointer;
    }
  }

  .menu {
    position: absolute;
    top: -10px;
    left: 36px;
    z-index: 1;
    display: flex;
    flex-direction: column;
    box-shadow: 2px 2px 8px 0 rgba(175, 171, 255, 0.5);
    border: solid 2px $delta-secondary;
    background-color: white;
    padding: 10px 18px;
    border-radius: 10px;

    &:after {
      position: absolute;
      left: -8px;
      top: 14px;
      width: 12px;
      height: 12px;
      border-left: solid 2px $delta-secondary;
      border-bottom: solid 2px $delta-secondary;
      background-color: white;
      transform: rotate(45deg);
      content: '';
    }

    .menu__option {
      white-space: nowrap;
      color: $dark-gray;
      font-weight: 600;

      &:hover {
        color: $delta-primary;
        cursor: pointer;
      }

      &:not(:last-child) {
        margin-bottom: 10px;
      }
    }
  }
}
</style>