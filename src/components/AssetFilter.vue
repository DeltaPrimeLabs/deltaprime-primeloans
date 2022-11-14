<template>
  <div class="asset-filter-component">
    <div class="asset-filter" v-if="assetOptions && filterValue">
      <div class="filter__option"
           v-for="option in assetOptions"
           v-on:click="selectOption(option)"
           v-bind:class="{'active': filterValue[option].active}">
        <img class="option__icon" :src="logoSrc(option)">
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AssetFilter',
  props: {
    assetOptions: null,
  },

  data() {
    return {
      filterValue: null,
    }
  },

  methods: {
    setupFilterValue() {
      this.filterValue = {};
      this.assetOptions.forEach(option => {
        this.filterValue[option] = {asset: option, active: true};
      });
    },

    selectOption(option) {
      const allSelected = Object.values(this.filterValue).map(option => option.active).every(o => o);
      if (allSelected) {
        Object.keys(this.filterValue).forEach(asset => {
          this.filterValue[asset].active = false;
        });
        this.filterValue[option].active = true;
      } else {
        this.filterValue[option].active = !this.filterValue[option].active;
        const noneSelected = Object.values(this.filterValue).map(option => option.active).every(o => !o);
        if (noneSelected) {
          Object.keys(this.filterValue).forEach(asset => {
            this.filterValue[asset].active = true;
          });
        }
      }
      this.$forceUpdate();
      const selectedAssets = Object.values(this.filterValue).filter(option => option.active).map(option => option.asset);
      this.$emit('FILTER', selectedAssets);
    }
  },

  watch: {
    assetOptions: {
      handler() {
        this.setupFilterValue();
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.asset-filter-component {

  .asset-filter {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;

    .filter__option {
      width: 26px;
      height: 26px;
      padding: 2px;
      background-color: white;
      border-radius: 26px;
      filter: grayscale(1);
      margin-right: 8px;
      transition: all 200ms ease-in-out;
      cursor: pointer;

      &:hover {
        filter: grayscale(0.3);
      }

      &.active {
        box-shadow: 1px 2px 5px 0 rgba(191, 188, 255, 0.9);
        filter: grayscale(0);
      }

      .option__icon {
        height: 22px;
        width: 22px;
      }
    }
  }
}

</style>