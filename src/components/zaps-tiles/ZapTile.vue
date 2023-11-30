<template>
  <div class="zap-tile__border">
    <div class="zap-tile" :class="{'disabled': disabled}" @click="onTileClick()">
      <div class="label">
        <slot name="label"></slot>
      </div>
      <div class="header">{{ header }}</div>
      <slot></slot>
      <div class="images">
        <img class="image" :src="imgSrc">
        <img class="image image--dark" :src="darkImgSrc">
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "ZapTile",
  props: {
    disabled: false,
    header: null,
    imgSrc: null,
    darkImgSrc: null,
  },
  methods: {
    onTileClick: function () {
      this.$emit('tileClick', null);
    }
  }
}
</script>

<style scoped lang="scss">
.zap-tile__border {
  width: 280px;
  height: 350px;
  display: flex;
  padding: 0 3px 3px 3px;
  position: relative;
  transition: box-shadow 200ms ease-in-out, transform 200ms ease-in-out;
  box-shadow: var(--zap-tile__zap-tile-shadow);
  border-radius: 26px;

  &:before {
    content: '';
    position: absolute;
    border-style: solid;
    border-width: 3px;
    border-image-source: var(--zap-tile__border--hover);
    border-image-slice: 1;
    background-image: var(--zap-tile__border-background--hover);
    background-origin: border-box;
    background-clip: padding-box, border-box;
    inset: -3px;
    border-radius: 26px;
    opacity: 0;
    transition: opacity 200ms ease-in-out;
  }

  &:hover:not(.disabled) {
    transform: scale(1.02);

    &:before {
      opacity: 1;
    }

    .zap-tile {
      .header {
        color: var(--zap-tile__header-color--hover);
      }
    }
  }
}

.zap-tile {
  width: 100%;
  height: 100%;
  border-radius: 23px;
  padding: 56px 83px 40px 83px;
  position: relative;
  cursor: pointer;
  transition: background 200ms ease-in-out;
  background: var(--zap-tile__background-color);
  display: flex;
  flex-direction: column;
  align-items: center;

  &.disabled {
    cursor: default;
    opacity: 30%;
  }
}

.label {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 0 0 8px 8px;
  background: var(--zap-tile__label-background-color);
  color: var(--zap-tile__label-color);
  padding: 4px 16px;
  font-size: 18px;
}

.header {
  text-align: center;
  font-size: 18px;
  color: var(--zap-tile__header-color);
  font-weight: 700;
  margin-bottom: 16px;
  transition: color 200ms ease-in-out;
}

.images {
  position: relative;
  width: 97px;
  height: 89px;
}

.image {
  position: absolute;
  inset: 0;
  user-select: none;
  opacity: var(--show-light-opacity);

  &.image--dark {
    opacity: var(--show-dark-opacity);
  }
}
</style>
