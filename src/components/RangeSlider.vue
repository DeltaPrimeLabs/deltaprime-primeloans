<template>
  <div class="range-slider">
    <div class="slider-container">
      <div class="slider-track" :style="trackStyle"></div>
      <div
        class="slider-thumb"
        v-for="(thumb, index) in thumbs"
        :key="index"
        :style="thumbStyle(index)"
        @mousedown="startDrag(index)"
      ></div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RangeSlider',
  props: {
    min: {
      type: Number,
      default: 0
    },
    max: {
      type: Number,
      default: 50
    },
    value: {
      type: Array,
      default: [10, 40]
    },
  },
  data() {
    return {
      dragging: false,
      thumbs: [0, 1], // Number of thumbs in the slider
    };
  },
  computed: {
    trackStyle() {
      const leftThumbValue = this.getThumbValue(0);
      const rightThumbValue = this.getThumbValue(1);
      return {
        left: leftThumbValue + "%",
        width: rightThumbValue - leftThumbValue + "%",
      };
    },
  },
  methods: {
    getThumbValue(index) {
      const range = this.max - this.min;
      return ((this.value[index] - this.min) / range) * 100;
    },
    updateValue(index, newValue) {
      const range = this.max - this.min;
      const percentage = Math.max(0, Math.min(100, (newValue / this.$el.offsetWidth) * 100));
      const newValueInRange = this.min + (range * percentage) / 100;
      const newValueRounded = Math.round(newValueInRange);

      if (index === 0 && newValueRounded > this.value[1]) return;
      if (index === 1 && newValueRounded < this.value[0]) return;

      this.$set(this.value, index, newValueRounded);
      this.$emit("input", this.value);
    },
    thumbStyle(index) {
      return {
        left: this.getThumbValue(index) + "%",
      };
    },
    startDrag(index) {
      this.dragging = index;
      window.addEventListener("mousemove", this.handleDrag);
      window.addEventListener("mouseup", this.endDrag);
    },
    handleDrag(event) {
      if (this.dragging !== false) {
        this.updateValue(this.dragging, event.pageX - this.$el.getBoundingClientRect().left);
      }
    },
    endDrag() {
      this.dragging = false;
      window.removeEventListener("mousemove", this.handleDrag);
      window.removeEventListener("mouseup", this.endDrag);
    },
  },
};
</script>

<style lang="scss" scoped>

.range-slider {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;

  .slider-container {
    position: relative;
    width: 100%;
    height: 20px;
    border-radius: 10.5px;
    box-shadow: var(--range-slider__container-box-shadow);
    background-color: var(--range-slider__container-box-background);

    .slider-track {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      border-radius: 10.5px;
      background-color: var(--range-slider__slider-track);
      z-index: 1;
    }

    .slider-thumb {
      position: absolute;
      transform: translate(-12px, -2px);
      width: 24px;
      height: 24px;
      border-radius: 50%;
      box-shadow: var(--range-slider__slider-thumb-box-shadow);
      border: var(--range-slider__slider-thumb-border);
      background-color: var(--range-slider__slider-thumb-background);
      cursor: pointer;
      z-index: 2;

      &::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background-color: var(--range-slider__slider-thumb-background);
      }
    }
  }
}
</style>
