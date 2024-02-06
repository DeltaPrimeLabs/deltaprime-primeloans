<template>
  <div class="text-input-wrapper">
    <div class="input-wrapper"
         @click="$refs.input.focus()">
      <span class="input">
        <input ref="input"
               v-model="internalValue"
               :disabled="disabled"
               placeholder="Referral nick..."
               lang="en-US">
      </span>
    </div>
    <div class="info"
         v-if="!error"
         :style="{'order': flexDirection === 'row' ? 1 : ''}">
      <div
          v-if="info && value && !isNaN(value) && !waiting && !ongoingErrorCheck"
          v-html="info(value)"></div>
    </div>
    <div class="error"
         v-if="error"
         :style="{'order': flexDirection === 'row' ? 1 : ''}">
      <span>
        <img src="src/assets/icons/error.svg"/>
        <span v-html="error" class="error-message"></span>
      </span>
    </div>
    <div class="warning"
         v-if="warning && !error && !waiting && !ongoingErrorCheck">
      <span>
        <img src="src/assets/icons/error.svg"/>
        {{ warning }}
      </span>
    </div>
  </div>
</template>


<script>
import config from '@/config';
import {mapState} from 'vuex';
import InfoIcon from "./InfoIcon.vue";
import {smartRound} from "../utils/calculate";

export default {
  name: 'TextInput',
  components: {InfoIcon},
  props: {
    flexDirection: {type: String, default: 'column'},
    validators: {
      type: Array, default: () => []
    },
    warnings: {
      type: Array, default: () => []
    },
    //TODO: make an array like in validators
    typingTimeout: {type: Number, default: 0},
    info: {type: Function, default: null},
    defaultValue: null,
    waiting: false,
    disabled: false,
    delayErrorCheckAfterValuePropagation: {type: Boolean, default: false},
  },
  computed: {},
  data() {
    return {
      error: '',
      warning: '',
      disabledStringifiedValue: null,
      timer: 0,
      value: this.defaultValue,
      ongoingErrorCheck: false,
      usdDenominated: true,
      internalValue: this.defaultValue,
    };
  },
  created() {
    this.setupDefaultValidators();
  },
  watch: {
    value: function (newValue) {
      this.updateValue(newValue);
    },
    defaultValue: function (newValue) {
      this.value = newValue;
    },
    warnings: function () {
      this.checkWarnings(this.value);
    },
    validators: function () {
      this.checkErrors(this.value);
    },
  },
  methods: {
    async updateValue(value) {
      this.ongoingErrorCheck = true;
      this.$emit('ongoingErrorCheck', this.ongoingErrorCheck);

      if (this.delayErrorCheckAfterValuePropagation) {
        setTimeout(async () => {
          await this.checkErrors(value);
        });
      } else {
        await this.checkErrors(value);
      }

      this.ongoingErrorCheck = false;
      this.$emit('ongoingErrorCheck', this.ongoingErrorCheck);

      await this.checkWarnings(value);

      const hasError = this.error.length > 0;

      this.$emit('newValue', {value: value, error: hasError });
    },
    async checkWarnings(newValue) {
      this.warning = '';

      for (const validator of [...this.warnings]) {
        let value = typeof newValue === 'number' ? newValue : 0;

        let validatorResult = await validator.validate(value);
        if (validatorResult) {
          this.warning = validatorResult;
        }
      }
    },

    async forceValidationCheck() {
      return this.checkErrors(this.value);
    },

    async checkErrors(newValue) {
      this.error = '';

      for (const validator of [...this.validators]) {
        let value = typeof newValue === 'number' ? newValue : 0;

        let validatorResult = await validator.validate(value);
        if (validatorResult) {
          this.error = validatorResult;
        }
      }
      return this.error;
    },


  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.currency-input-wrapper {

  &.embedded {
    height: 60px;

    .input-wrapper {
      box-shadow: none;
      background-image: none;
    }
  }
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--currency-input__box-shadow);
  background-image: var(--currency-input__background);
  height: 60px;
  border-radius: 15px;
  padding-left: 15px;
  padding-right: 15px;
  border: none;
  width: 100%;

  @media screen and (min-width: $md) {
    padding-left: 30px;
    padding-right: 20px;
  }

  .input-extras-wrapper {
    display: flex;
    align-items: center;
  }
}

.input {
  position: relative;
}

input {
  color: var(--currency-input__input-color);
  background: transparent;
  border: none;
  font-family: Montserrat;
  font-weight: 600;
  font-size: 24px;
  padding-top: 0;
  padding-bottom: 0;
  max-width: 40%;

  &:disabled {
    opacity: 77%;
    color: transparent;
  }

  @media screen and (min-width: $md) {
    padding-right: 5px;
    max-width: none;
  }
}

input:focus {
  outline: none;
}

// hiding arrows
/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type=number] {
  -moz-appearance: textfield;
}

.converted {
  color: var(--currency-input__converted-color);
  margin-right: 15px;
  white-space: nowrap;
  text-align: right;
  width: 140px;
  font-size: $font-size-sm;
  opacity: 0.6;
  display: none;

  @media screen and (min-width: $md) {
    display: block;
  }

  > div {
    text-overflow: ellipsis;
    overflow: hidden;
    display: flex;
    flex-direction: column;

  }
}

.symbol {
  margin-left: 10px;
  font-family: 'Lato';
  font-weight: 900;
  font-size: 18px;
}

.logo-wrapper {
  display: flex;
  align-items: center;
}

.logo.secondary {
  transform: translateX(-10px);
}

.max-wrapper {
  cursor: pointer;
  width: 35px;
  min-width: 35px;
  margin-right: 20px;


  .max {
    border: var(--currency-input__max-border);
    border-radius: 10px;
    width: 45px;
    height: 26px;
    font-weight: bold;
    line-height: 24px;
    color: var(--currency-input__max-color);
    text-align: center;
    background-color: var(--currency-input__max-background);

    &:hover {
      color: var(--currency-input__max-color--hover);
      background-color: var(--currency-input__max-background--hover);
      border: var(--currency-input__max-border--hover);
    }
  }
}

img {
  height: 24px;
  width: 24px;

  @media screen and (min-width: $md) {
    height: 36px;
    width: 36px;
  }
}

.error, .info, .warning {
  min-height: 30px;
  padding-top: 6px;
  color: var(--currency-input__error-info-warngin-color);
  font-size: 14px;
  width: 100%;
  text-align: start;
}

.warning {
  //color: #F5A200;
  color: var(--currency-input__warning-color);
}

.error, .warning {
  img {
    width: 20px;
    height: 20px;
    transform: translateY(-1px);
  }
}

.error {
  color: var(--currency-input__error-color);
}

.denomination {
  min-width: 90px;

  .icon {
    width: 20px;
    cursor: pointer;

    &:hover {
      transform: scale(1.05);
    }
  }

  .slash {
    height: 24px;
    width: 12px;
  }
}

.disabled-input-text {
  position: absolute;
  font-weight: 600;
  font-size: 24px;
  letter-spacing: normal;
  color: var(--currency-input__input-color);
  max-width: 290px;
  opacity: 0;
  padding-left: 2px;
  overflow: hidden;

  &.visible {
    opacity: 77%;
  }
}
</style>
