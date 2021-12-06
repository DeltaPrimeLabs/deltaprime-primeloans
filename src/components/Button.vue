<template>
  <button class="btn" :class="[disabled ? 'disabled': '', waiting ? 'waiting': '', 'purple']" @click="clicked()">
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
        this.$emit('click', true);
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
  border-width: 1px;
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
    padding: 17px 40px;
    font-size: $font-size-lg;
  }

  .btn-label {
    min-width: 57px;
  }

  .ball-beat {
    display: none;
  }

  &.disabled {
    opacity: 0.5;
    cursor: initial;
  }

  &.waiting {
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

.btn:hover:not(.waiting):not(.disabled) {
  opacity: 0.8;
}

.btn:active {
  opacity: 0.5;
}

.purple {
  color: #ffffff;
  background-image: linear-gradient(99deg, #4f56e6 2%, #7f84ff 64%, #a28aff);
  box-shadow: 5px 5px 8px 0 rgba(191, 188, 255, 0.5);
}

.purple:hover {
  background-color: #ff788a;
}
</style>

