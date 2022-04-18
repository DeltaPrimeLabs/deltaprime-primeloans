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
      currentValue: this.value,
      error: '',
      value: null,
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
  box-shadow: inset 0 1px 3px 0 rgba(191, 188, 255, 0.7);
  background-color: rgba(191, 188, 255, 0.2);

  background-origin: content-box;

  background-image: linear-gradient(to right, #a5a9ff 17%, #c0a6ff 91%);
  background-size: 0% 100%;
  background-repeat: no-repeat;

  &.error {
    background: $red;
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 23px;
    height: 23px;
    background: #fff;
    cursor: pointer;
    border-radius: 50%;
    border: solid 3px #c0a6ff;
  }

  &.error::-webkit-slider-thumb {
    border-color: $red;
  }

  &::-moz-range-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 23px;
    height: 23px;
    background: #fff;
    cursor: pointer;
    border-radius: 50%;
    border: solid 3px #c0a6ff;
  }

  &.error::-moz-range-thumb {
    border-color: $red;
  }
}

.slider-component .slide-container .slider:hover {
  opacity: 1;
}

.labels {
  display: flex;
  justify-content: space-between;
  color: #7d7d7d;
  font-weight: 500;
}

.error {
  text-align: end;
  height: 24px;
  color: $red;

  img {
    width: 20px;
    height: 20px;
  }
}
</style>
