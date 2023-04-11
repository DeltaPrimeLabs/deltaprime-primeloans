<template>
  <button class="btn" :class="[disabled ? 'disabled': '', waiting ? 'disabled waiting': '', 'purple']"
          @click="clicked()">
    <div class="btn-label">
      {{ label }}
    </div>
    <vue-loaders-ball-beat color="#FFFFFF" scale="0.5"></vue-loaders-ball-beat>
  </button>
</template>


<script>
export default {
  name: 'Button',
  props: {
    disabled: false,
    waiting: false,
    label: ''
  },
  methods: {
    clicked() {
      if (!(this.disabled || this.waiting)) {
        this.$emit('click', true);
      }
    }
  },
}
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.btn {
  display: inline-block;
  font-weight: 800;
  color: rgb(66, 66, 66);
  text-align: center;
  vertical-align: middle;
  user-select: none;
  background-color: transparent;
  line-height: 1.5;
  border-width: 0;
  border-style: solid;
  border-color: transparent;
  border-image: initial;
  border-radius: 999px;
  font-family: 'Montserrat', sans-serif;
  text-transform: uppercase;
  cursor: pointer;
  font-size: $font-size-md;
  padding: 0.75rem 1.5rem;

  @media screen and (min-width: $md) {
    padding: 18px 41px;
    font-size: $font-size-xl;
  }

  .btn-label {
    min-width: 57px;
  }

  .ball-beat {
    display: none;
  }

  &.disabled {
    cursor: not-allowed;
    box-shadow: none;
  }

  &.waiting {
    cursor: wait;

    .btn-label {
      visibility: hidden;
      height: 0;
    }

    .ball-beat {
      display: block;
      margin-top: 7px;
      margin-bottom: 8px;
    }
  }
}

.purple {
  color: var(--button__purple-color);
  background-image: var(--button__purple-background);
  box-shadow: var(--button__purple-box-shadow);

  &:hover {
    background-image: var(--button__purple-background--hover);
  }

  &.disabled {
    color: var(--button__purple-color--disabled);
    background-image: var(--button__purple-background--disabled);
    box-shadow: none;
  }
}
</style>

