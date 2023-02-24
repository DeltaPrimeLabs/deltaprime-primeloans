<template>
  <div class="banner" v-if="bannerVisible" :class="`${background + ' ' + 'font-' + fontColor}`">
    <div class="elements">
      <slot></slot>
    </div>
    <img v-if="closable" v-on:click="closeBanner()" class="close-button" :src="`src/assets/icons/cross-${fontColor}.svg`">
  </div>
</template>


<script>
  export default {
    name: 'Banner',
    props: {
      title: String,
      closable: {
        type: Boolean,
        default: false,
      },
      background: {
        type: String,
        default: '',
      }
    },
    data() {
      return {
        bannerVisible: true,
      }
    },
    methods: {
      closeBanner() {
        this.bannerVisible = false;
      }
    },
    computed: {
      fontColor() {
        return this.background === 'green' ? 'white' : 'black';
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.banner {
  position: relative;
  top: 0;
  height: 60px;
  display: flex;
  background-color: #F4D35E;
  font-weight: bold;
  width: 100%;
  justify-content: space-around;
  align-items: center;
  z-index: 2;

  a {
    cursor: pointer;
  }

  &.green {
    background-color: $lime-green;
  }

  &.font-white {
    color: white;
  }

  .close-button {
    position: absolute;
    right: 25px;
    cursor: pointer;
  }
}
</style>

