<template>
  <div id="icon-button-menu-component" class="icon-button-menu-component"
       v-tooltip="!menuOpen && config.tooltip ? {content: config.tooltip, classes: 'button-tooltip'} : null">
    <Bubble v-if="bubbleText">
      <div v-html="bubbleText"></div>
    </Bubble>
    <div ref="icon" id="icon-button-container" class="icon-button"
         v-bind:class="{'icon-button--disabled': config.disabled || disabled}"
         v-on:click="iconButtonClick($event)">
    </div>
    <div class="menu" v-if="config.menuOptions && this.menuOpen">
      <div class="menu__option"
           v-for="option in config.menuOptions"
           v-if="option && (!option.hidden || showHiddenOptions)"
           v-bind:class="{'menu__option--disabled': option.disabled}"
           v-bind:key="option.key"
           v-on:click="menuOptionClick(option)">
        <div class="option__text" v-bind:class="{'option__text--disabled': option.disabled}">
          {{ option.name }}
        </div>
        <div class="option__info__wrapper">
          <img class="option__info-icon"
               v-if="option.disabled" src="src/assets/icons/info.svg"
               v-tooltip="{content: option.disabledInfo}">
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Bubble from './Bubble';

export default {
  name: 'IconButtonMenuBeta',
  components: {Bubble},
  props: {
    config: {
      type: Object,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    bubbleText: {
      type: String,
      default: '',
    }
  },
  mounted() {
    document.addEventListener('icon-menu-open', () => {
      this.menuOpen = false;
    }, false);
    this.$refs.icon.style.webkitMaskImage = `url(${this.config.iconSrc})`;
  },
  data() {
    return {
      menuOpen: false,
      showHiddenOptions: false,
    };
  },
  methods: {
    iconButtonClick(event) {
      this.showHiddenOptions = event.metaKey || event.altKey;
      if (!this.config.disabled && !this.disabled) {
        if (this.config.menuOptions) {
          if (!this.menuOpen) {
            this.emitGlobalCloseOfAllMenus();
            this.stopObserveOutsideClick();
          }
          this.observeOutsideClick();
          this.menuOpen = !this.menuOpen;
        } else {
          this.$emit('iconButtonClick', this.config.iconButtonActionKey);
          this.emitGlobalCloseOfAllMenus();
          this.stopObserveOutsideClick();
        }
      }
    },

    menuOptionClick(option) {
      if (!option.disabled) {
        this.$emit('iconButtonClick', option.key);
        this.emitGlobalCloseOfAllMenus();
      }
    },

    emitGlobalCloseOfAllMenus() {
      const event = new Event('icon-menu-open');
      document.dispatchEvent(event);
    },

    closeMenuOnClickOutside(event) {
      if (!document.getElementById('icon-button-menu-component').contains(event.target) && event.target.id !== 'icon-button--hover') {
        if (this.menuOpen) {
          this.menuOpen = false;
        }
      }
    },

    observeOutsideClick() {
      document.addEventListener('click', this.closeMenuOnClickOutside);
    },

    stopObserveOutsideClick() {
      document.removeEventListener('click', this.closeMenuOnClickOutside);
    },
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
    cursor: pointer;
    mask-size: cover;
    -webkit-mask-size: cover;
    background: var(--icon-button-menu-beta__icon-color--default);

    &:hover {
      background: var(--icon-button-menu-beta__icon-color-hover--default);
    }

    &.icon-button--disabled {
      opacity: 0.5;
      filter: grayscale(1);
      cursor: default;
      pointer-events: none;
    }
  }

  .menu {
    position: absolute;
    top: -10px;
    left: 36px;
    z-index: 1;
    display: flex;
    flex-direction: column;
    box-shadow: var(--icon-button-menu-beta__menu-box-shadow);
    border: solid 2px var(--icon-button-menu-beta__menu-border-color);
    background-color: var(--icon-button-menu-beta__menu-background-color);
    padding: 10px 18px;
    border-radius: 10px;

    &:after {
      position: absolute;
      left: -8px;
      top: 14px;
      width: 12px;
      height: 12px;
      border-left: solid 2px var(--icon-button-menu-beta__menu-border-color);
      border-bottom: solid 2px var(--icon-button-menu-beta__menu-border-color);
      background-color: var(--icon-button-menu-beta__menu-background-color);
      transform: rotate(45deg);
      content: '';
    }

    .menu__option {
      display: flex;
      flex-direction: row;
      white-space: nowrap;
      color: var(--icon-button-menu-beta__menu-color);
      font-weight: 600;
      cursor: pointer;

      &:not(:last-child) {
        margin-bottom: 10px;
      }

      &:hover {
        .option__text:not(.option__text--disabled) {
          color: var(--icon-button-menu-beta__menu-color--hover);
        }
      }

      .option__text--disabled {
        opacity: 0.5;
        cursor: default;
      }

      .option__info__wrapper {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        margin-left: 5px;

        .option__info-icon {
          width: 16px;
          height: 16px;
        }
      }
    }
  }
}
</style>

<style lang="scss">
.info-tooltip {
  max-width: 156px;
}
</style>
