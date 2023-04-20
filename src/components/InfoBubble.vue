<template>
  <div class="info-bubble-wrapper" v-if="shouldShow">
    <div class="info-bubble">
      <InfoIcon :size="42" class="info"></InfoIcon>
      <div class="text">
        <slot></slot>
      </div>
      <img class="cross clickable-icon" v-if="cacheKey" @click="hide">
    </div>
  </div>
</template>


<script>
import InfoIcon from "./InfoIcon.vue";

export default {
  name: 'InfoBubble',
  components: {InfoIcon},
  props: {
    cacheKey: '',
    hidden: false
  },
  methods: {
    hide() {
      localStorage.setItem(this.cacheKey, 'false');
      this.hidden = true;
    }
  },
  computed: {
    shouldShow() {
      return !this.hidden && localStorage.getItem(this.cacheKey) !== 'false';
    }
  }
}
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.info-bubble-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 10px;

  &:nth-child(2) {
    margin-top: 40px;
  }

  .info-bubble {
    width: 576px;
    position: relative;
    mask-image: url("../assets/icons/bubble-body.svg");
    -webkit-mask-image: url("../assets/icons/bubble-body.svg");
    min-width: 550px;
    background: var(--info-bubble__info-bubble);
    display: flex;
    align-items: center;
    padding: 23px 30px 45px 29px;
    font-weight: 500;
    color: var(--info-bubble__color);
    line-height: 24px;
    font-size: 16px;
    background-size: cover;
    -webkit-mask-position: center;
    -webkit-mask-repeat: no-repeat;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      mask-image: url("../assets/icons/bubble-stroke.svg");
      -webkit-mask-image: url("../assets/icons/bubble-stroke.svg");
      background: var(--info-bubble__info-bubble-stroke);
      -webkit-mask-position: center;
    }

    .info {
      margin-right: 20px;
    }

    .text {
      text-align: left;
      z-index: 1;
    }

    .cross {
      position: absolute;
      right: 36px;
      top: 20px;
      z-index: 1;
      align-self: flex-start;
      cursor: pointer;
      content: url(../assets/icons/cross.svg);

      &:hover {
        content: url(../assets/icons/hover/cross.svg);
      }
    }

    a {
      color: #7d7d7d;
      font-weight: 600;
    }
  }
}

</style>

