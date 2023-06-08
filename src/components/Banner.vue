<template>
  <div class="banner" v-if="bannerVisible" :class="`${background + ' ' + 'font-' + fontColor}`">
    <div class="elements">
      <slot></slot>
    </div>
    <DeltaIcon v-if="closable" class="close-button" v-on:click.native="closeBanner()" :icon-src="'src/assets/icons/cross.svg'" :size="21"></DeltaIcon>
  </div>
</template>


<script>
  import DeltaIcon from "./DeltaIcon.vue";

  export default {
    name: 'Banner',
    components: {DeltaIcon},
    props: {
      id: {
        type: String,
        default: 'BannerID'
      },
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
        localStorage.setItem(this.id, 'CLOSED');
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
  height: 50px;
  display: flex;
  background-color: var(--banner__banner-background);
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  width: 100%;
  justify-content: space-around;
  align-items: center;
  z-index: 2;

  a {
    cursor: pointer;
    color: var(--banner__banner-color--link);

    b {
      font-weight: 800 !important;
    }
  }

  &.green {
    background-color: var(--banner__banner-background--green);
    color: var(--banner__banner-color--green) !important;

    .close-button {
      background: var(--banner__banner-color--green);
    }

    a {
      color: var(--banner__banner-color--green);
    }
  }

  &.green-accent {
    background-color: var(--banner__banner-background--green-accent);
    color: var(--banner__banner-color--green) !important;

    .close-button {
      background: var(--banner__banner-color--green);
    }

    a {
      color: var(--banner__banner-color--green);
    }
  }

  &.font-white {
    color: var(--banner__banner-color--font-white);
  }

  .close-button {
    position: absolute;
    right: 25px;
    cursor: pointer;
    background: var(--banner__banner-color--link);
  }
}
</style>

