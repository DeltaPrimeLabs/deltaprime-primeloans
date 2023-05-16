<template>
  <div class="toggle-component">
    <div class="toggle">
      <div class="toggle__options">
        <div class="option"
             v-for="option in options"
             v-bind:key="option"
             v-bind:id="'option-' + option"
             v-bind:class="{'option--selected': option === selectedOption}"
             v-on:click="clickOption(option)">{{ option }}
        </div>
      </div>
      <div ref="pointer" class="pointer"></div>
      <div class="toggle__background"></div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RoundToggle',
  props: {
    options: Array,
    initialOption: Number
  },
  data() {
    return {
      selectedOption: this.$props.initialOption ? this.$props.options[this.$props.initialOption] : this.$props.options[0]
    };
  },
  mounted() {
    this.setup();
  },
  methods: {
    setup() {
      setTimeout(() => {
        const selectedOptionElement = document.getElementById(`option-${this.selectedOption}`);
        const selectOptionRect = selectedOptionElement.getBoundingClientRect();
        this.$refs.pointer.style.width = `${selectOptionRect.width}px`;
        this.$refs.pointer.style.left = `${selectedOptionElement.offsetLeft}px`;
      }, 100);
    },

    clickOption(option) {
      if (option !== this.selectedOption) {
        this.selectedOption = option;
        this.$emit('change', option);
        const targetOptionElement = document.getElementById(`option-${option}`);
        const targetOptionRect = targetOptionElement.getBoundingClientRect();
        this.$refs.pointer.style.left = `${targetOptionElement.offsetLeft}px`;
        this.$refs.pointer.style.width = `${targetOptionRect.width}px`;
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.toggle-component {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  .toggle {
    display: flex;
    position: relative;

    .pointer {
      position: absolute;
      left: 0;
      height: 32px;
      width: 50px;
      margin: 0 80px 0 0;
      padding: 6px 12px;
      box-shadow: var(--notifi-settings__box-shadow);
      border-radius: 10px;
      backdrop-filter: contrast(200%) brightness(150%);
      z-index: 1;
      transition: all 100ms;

      &:before {
        content: '';
        position: absolute;
        border-radius: 10px;
        inset: 0;
        background: var(--toggle__pointer-border);
      }

      &:after {
        content: '';
        position: absolute;
        border-radius: 10px;
        inset: 1px;
        background: var(--toggle__pointer-background);
      }
    }

    .toggle__options {
      display: flex;
      flex-direction: row;
      border-radius: 10px;
      font-size: $font-size-sm;
      color: var(--toggle__options-color);
      z-index: 2;

      .option {
        padding: 6px 12px;
        cursor: pointer;

        &.option--selected {
          color: var(--notifi-settings__active-option-font-color);
          font-weight: 600;
        }

        &:hover {
          color: var(--toggle__options-color--hover);
        }
      }
    }

    .toggle__background {
      position: absolute;
      inset: 0;
      height: 32px;
      background-color: var(--toggle__background);
      border: var(--toggle__border);
      z-index: 0;
      border-radius: 10px;
    }
  }
}

</style>
