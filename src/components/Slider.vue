<template>
  <div>
    <div class="slider-component">
      <div class="slide-container">
        <input
            ref="input"
            v-model="currentValue"
            type="range"
            :step="step"
            :min="min"
            :max="max"
            class="slider"
            :class="{'error': error}"
            @input="onInput"
        >
      </div>
    </div>
    <div class="labels" v-if="labels">
      <div v-for="label in labels" :key="label">{{ label }}</div>
    </div>
    <div class="error">
      <span v-if="error">
        <img src="src/assets/icons/error.svg"/>
        {{ error }}
      </span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Slider',
  props: {
    min: {
      type: Number,
      required: true
    },
    max: {
      type: Number,
      required: true
    },
    step: {
      type: Number,
      required: true
    },
    validators: {
      type: Array, default: () => []
    },
    labels: {
      type: Array, default: null
    }
  },
  data() {
    return {
      currentValue: 0,
      error: '',
      value: 0,
    };
  },
  methods: {
    onInput() {
      this.currentValue = Number(this.currentValue);
      if (this.currentValue >= this.max) {
        this.onChange(this.max, false);
        this.$emit('input', this.max);
      } else {
        this.onChange(this.currentValue, false);
        this.$emit('input', this.currentValue);
      }
    },
    restyleInput(element, value) {
      const min = parseFloat(element.min);
      const max = parseFloat(element.max);

      if (value < this.min) {
        element.style.backgroundSize = '0% 100%';
      } else {
        let size = (value - min) / (max - min);
        //calculated this way to account for a thumb width
        element.style.backgroundSize =
          'calc(' + size * 100 + '% - ' + (size - 0.5) * 23 + 'px)'
          + ' 100%';
      }
    },
    async onChange(newValue, externalChange) {
      if (!externalChange) {
        if (newValue >= this.max) {
          newValue = this.max;
        }
      }
      this.currentValue = newValue;
      this.restyleInput(this.$refs.input, newValue)

      this.error = '';

      for (const validator of [...this.validators]) {
        let value = typeof newValue === "number" ? newValue : 0;

        let validatorResult = await validator.validate(value);
        if (validatorResult) {
          this.error = validatorResult;
        }
      }

      const hasError = this.error.length > 0;

      this.$emit('newValue', {value: this.currentValue, error: hasError});
    }
  },
  watch: {
    max(newValue) {
      this.$refs.input.max = newValue;
      this.onChange(newValue);
      this.currentValue = newValue;
    },
    min(newValue) {
      this.$refs.input.min = newValue;
      this.onChange(newValue);
      this.currentValue = newValue;
    }
  }
};

</script>

<style scoped lang="scss">
@import "~@/styles/variables";

.slider-component .slide-container {
  width: 100%;
}

.slider-component .slide-container .slider {
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  outline: none;
  -webkit-transition: .2s;
  transition: opacity .2s;
  height: 21px;
  border-radius: 10.5px;
  box-shadow: var(--slider__box-shadow);
  background-color: var(--slider__slider-background-color);

  background-origin: content-box;

  background-image: var(--slider__slider-background-gradient);
  background-size: 0% 100%;
  background-repeat: no-repeat;

  &.error {
    background: var(--slider__slider-background--error);
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 23px;
    height: 23px;
    background: var(--slider__slider-thumb-background);
    cursor: pointer;
    border-radius: 50%;
    border: var(--slider__slider-thumb-border);
  }

  &.error::-webkit-slider-thumb {
    border-color: var(--slider__slider-thumb-border--error);
  }

  &::-moz-range-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 23px;
    height: 23px;
    background: var(--slider__slider-thumb-background);
    cursor: pointer;
    border-radius: 50%;
    border: var(--slider__slider-thumb-border);
  }

  &.error::-moz-range-thumb {
    border-color: var(--slider__slider-thumb-border--error);
  }
}

.slider-component .slide-container .slider:hover {
  opacity: 1;
}

.labels {
  display: flex;
  justify-content: space-between;
  color: var(--slider__labels-color);
  font-weight: 500;
}

.error {
  text-align: end;
  height: 24px;
  color: var(--slider__color--error);

  img {
    width: 20px;
    height: 20px;
  }
}
</style>
