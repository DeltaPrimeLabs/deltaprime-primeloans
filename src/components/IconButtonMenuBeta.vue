<template>
  <div id="icon-button-menu-component" class="icon-button-menu-component" v-if="config"
       v-tooltip="!menuOpen && config.tooltip ? {content: config.tooltip, classes: 'button-tooltip'} : null">
    <Bubble v-if="$slots.bubble">
      <slot name="bubble"></slot>
    </Bubble>
    <DeltaIcon :icon-src="config.iconSrc" :size="26"
               class="icon-button"
               v-bind:class="{'icon-button--disabled': config.disabled || disabled}"
               v-on:click.native="iconButtonClick($event)">

    </DeltaIcon>
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
          <InfoIcon
              v-if="option.disabled"
              class="option__info-icon"
              :tooltip="{content: option.disabledInfo}"
              :classes="'info-tooltip'"
          ></InfoIcon>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Bubble from './Bubble';
import InfoIcon from "./InfoIcon.vue";
import DeltaIcon from "./DeltaIcon.vue";

export default {
  name: 'IconButtonMenuBeta',
  components: {DeltaIcon, InfoIcon, Bubble},
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
          setTimeout(() => {
            this.observeOutsideClick();
          })
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
      if (!event.target.classList.contains('icon-button-menu-component')) {
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

  .icon-button {
    cursor: pointer;
    background: var(--icon-button-menu-beta__icon-color--default);

    &:hover {
      background: var(--icon-button-menu-beta__icon-color-hover--default);
    }

    &.icon-button--disabled {
      background: var(--icon-button-menu-beta__icon-color--disabled);
      cursor: default;
      pointer-events: none;
    }
  }

  .menu {
    position: absolute;
    transform: translate(calc(-100% + 34px), 14px);
    z-index: 1;
    display: flex;
    flex-direction: column;
    box-shadow: var(--icon-button-menu-beta__menu-box-shadow);
    border: solid 2px var(--icon-button-menu-beta__menu-border-color);
    background-color: var(--icon-button-menu-beta__menu-background-color);
    border-radius: 10px;

    &:after {
      position: absolute;
      right: 15px;
      top: -5px;
      width: 7px;
      height: 7px;
      border-left: solid 2px var(--icon-button-menu-beta__menu-border-color);
      border-top: solid 2px var(--icon-button-menu-beta__menu-border-color);
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
      line-height: 17px;
      cursor: pointer;
      padding: 10px 20px;

      &:not(:last-child) {
        border-bottom: var(--icon-button-menu-beta__menu-option-border);
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
