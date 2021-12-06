<template>
  <div class="info-bubble-wrapper" v-if="shouldShow">
    <div class="info-bubble">
      <img src="src/assets/icons/info.svg" class="info"/>
      <div v-html="text" class="text">
      </div>
      <img src="src/assets/icons/cross.svg" class="cross" v-if="cacheKey" @click="hide">
    </div>
  </div>
</template>


<script>
  export default {
    name: 'InfoBubble',
    props: {
      text: '',
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
  margin-top: 30px;

  .info-bubble {
    background-image: url("../assets/icons/bubble.svg");
    background-repeat: no-repeat;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 23px 30px 45px 29px;
    font-weight: 500;
    color: #7d7d7d;
    line-height: 24px;
    min-width: 550px;

    .info {
      margin-right: 20px;
    }

    .text {
      text-align: left;
    }

    .cross {
      align-self: flex-start;
      cursor: pointer;
    }
  }
}

</style>

