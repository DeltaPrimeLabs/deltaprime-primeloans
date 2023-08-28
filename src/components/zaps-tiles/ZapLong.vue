<template>
  <div class="zap-tile" @click="onTileClick()">
    <div class="label">
      up to <b>5x</b>
    </div>
    <div class="header">Long</div>
    <div class="icons">
      <img class="icon" v-for="icon in tokenIcons" :src="'src/assets/icons/' + icon">
    </div>
      <div class="more-label">...and more!</div>
      <img class="image" src="src/assets/icons/avax-icon.svg">
  </div>
</template>

<script>
export default {
  name: "ZapLong",
  data() {
    return {
      tokenIcons: [
        'avax-icon.svg',
        'avax-icon.svg',
        'avax-icon.svg',
        'avax-icon.svg',
        'avax-icon.svg',
        'avax-icon.svg',
      ]
    }
  },
  methods: {
    onTileClick() {
      console.log('tile click')
    }
  }
}
</script>

<style scoped>
.zap-tile {
  box-shadow: var(--zap-long__zap-tile-shadow);
  border-radius: 16px;
  padding: 48px 64px 32px 64px;
  position: relative;
  cursor: pointer;
  transition: box-shadow 200ms ease-in-out;

  &:hover {
    box-shadow: var(--zap-long__zap-tile-shadow--hover);
  }
}

.label {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 0 0 8px 8px;
  background: var(--zap-long__label-background-color);
  padding: 4px;
}

.header {
  text-align: center;
  font-size: 18px;
  color: var(--zap-long__header-color);
  font-weight: 700;
  margin-bottom: 16px;
}

.icons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  grid-column-gap: 16px;
  grid-row-gap: 16px;
  width: 116px;
  height: 72px;
  margin-bottom: 8px;
  user-select: none;
}

.icon {
  height: 100%;
}

.more-label {
  text-align: center;
}

.image {
  width: 118px;
  height: 118px;
  margin-top: 32px;
  user-select: none;
}

</style>
