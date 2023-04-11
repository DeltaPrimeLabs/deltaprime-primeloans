<template>
  <div class="asset-filter-component">
    <div class="asset-filter__group" v-for="(group, index) in assetFilterGroups">
      <div class="asset-filter" v-if="group && group.options && filterValue">
        <div class="filter__option"
             v-for="option in group.options"
             v-on:click="selectOption(group, option)"
             v-bind:class="{'active': filterValue[group.key][option].active}"
             v-tooltip="{content: option, classes: 'info-tooltip'}">
          <img v-if="group.key === 'asset'" class="option__icon" :src="logoSrc(option)">
          <img v-if="group.key === 'dex'" class="option__icon" :src="`src/assets/logo/${dexesConfig[option].logo}`">
        </div>
      </div>
      <div v-if="index !== assetFilterGroups.length - 1" class="filter__separator"></div>
    </div>
    <div class="filter__clear" v-if="!allSelected">
      <button class="clear__button" type="button" v-on:click="resetAll()">
        <DeltaIcon class="clear__icon" :size="14" :icon-src="'src/assets/icons/cross.svg'"></DeltaIcon>
        <span class="clear__text">Clear all filters</span>
      </button>
    </div>
  </div>
</template>

<script>
import config from '../config';
import DeltaIcon from "./DeltaIcon.vue";

export default {
  name: 'AssetFilter',
  components: {DeltaIcon},
  props: {
    assetOptions: null,
    assetFilterGroups: null,
  },

  data() {
    return {
      dexesConfig: config.DEX_CONFIG,
      filterValue: null,
      allSelected: true,
    };
  },

  methods: {
    setupFilterValue() {
      this.filterValue = {};
      this.assetFilterGroups.forEach((group, index) => {
        this.filterValue[group.key] = {};
        group.options.forEach(option => {
          this.filterValue[group.key][option] = {asset: option, active: true};
        });
      });
    },

    selectOption(group, option) {
      const allSelected = Object.values(this.filterValue[group.key]).map(option => option.active).every(o => o);
      if (allSelected) {
        Object.keys(this.filterValue[group.key]).forEach(o => {
          this.filterValue[group.key][o].active = false;
          this.checkResetButton();
          this.$forceUpdate();
        });
        this.filterValue[group.key][option].active = true;
        this.checkResetButton();
        this.$forceUpdate();
      } else {
        this.filterValue[group.key][option].active = !this.filterValue[group.key][option].active;
        this.$forceUpdate();
        this.checkResetButton();
        const noneSelected = Object.values(this.filterValue[group.key]).map(option => option.active).every(o => !o);
        if (noneSelected) {
          this.resetGroup(group);
        }
      }
      this.emitFilterValue();
    },

    resetGroup(group) {
      Object.keys(this.filterValue[group.key]).forEach(option => {
        this.filterValue[group.key][option].active = true;
        this.checkResetButton();
        this.$forceUpdate();
      });
    },

    resetAll() {
      console.log(this.filterValue);
      this.assetFilterGroups.forEach(group => {
        this.resetGroup(group);
      });
      this.emitFilterValue();
    },

    emitFilterValue() {
      const filterValue = {};
      Object.keys(this.filterValue).forEach(groupKey => {
        filterValue[groupKey] = Object.values(this.filterValue[groupKey]).filter(option => option.active).map(option => option.asset);
      });
      this.$emit('filterChange', filterValue);
    },

    checkResetButton() {
      let allSelectedPerGroup = {};
      Object.keys(this.filterValue).forEach(group => {
        allSelectedPerGroup[group] = Object.keys(this.filterValue[group]).every(option => this.filterValue[group][option].active);
      });
      this.allSelected = Object.keys(allSelectedPerGroup).every(group => allSelectedPerGroup[group]);
    },
  },

  watch: {
    assetFilterGroups: {
      handler() {
        // this.setupFilterValue();
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.asset-filter-component {
  display: flex;
  flex-direction: row;


  .asset-filter__group {
    display: flex;
    flex-direction: row;
    align-items: center;

    .asset-filter {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;

      .filter__option {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 26px;
        filter: grayscale(1);
        margin-right: 8px;
        transition: all 200ms ease-in-out;
        cursor: pointer;
        opacity: 0.5;

        &:last-child {
          margin-right: 0;
        }

        &:hover {
          filter: grayscale(0.3);
        }

        &.active {
          box-shadow: var(--asset-filter__filter-option-box-shadow);
          filter: grayscale(0);
          background-color: var(--dex-filter__filter-option-background-color);
          opacity: 1;
        }

        .option__icon {
          height: 22px;
          width: 22px;
        }
      }
    }

    .filter__separator {
      width: 1.5px;
      height: 17px;
      background-color: var(--asset-filter__filter-separator-color);
      margin: 0 15px;
    }
  }

  .filter__clear {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-left: 15px;

    .clear__button {
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 0;
      border: 0;
      margin: 0;
      background-color: transparent;
      cursor: pointer;

      &:hover {
        filter: brightness(0.85);
      }


      .clear__icon {
        background: var(--asset-filter__clear-text-color);
        margin-right: 3px;
      }

      .clear__text {
        font-size: $font-size-xsm;
        color: var(--asset-filter__clear-text-color);
        font-weight: 600;
        font-stretch: normal;
        font-style: normal;
        line-height: normal;
        letter-spacing: normal;
      }
    }
  }
}


</style>
