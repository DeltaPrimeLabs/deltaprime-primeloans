<template>
  <div class="asset-dropdown-component" v-if="displayedOptions">
    <div class="asset-dropdown">
      <div class="select" v-bind:class="{'expanded': expanded, 'has-background': hasBackground }">
        <div v-if="selectedAsset" class="selected-asset">
          <img class="selected-asset__icon" :src="`src/assets/logo/${selectedAsset.symbol.toLowerCase()}.${selectedAsset.logoExt ? selectedAsset.logoExt : 'svg'}`">
          <div class="selected-asset__symbol">{{selectedAsset.name ? selectedAsset.name : selectedAsset.symbol}}</div>
        </div>

        <DeltaIcon class="chevron"
                   :icon-src="`src/assets/icons/chevron-down.svg`"
                   :size="21"
                   v-on:click.native="toggleSelect()"
                   v-if="displayedOptions && displayedOptions.length > 0 && assetOptions.length > 1">
        </DeltaIcon>
        <div class="dropdown-panel" v-if="expanded" v-on:click="dropdownPanelClick()"></div>
        <div class="select-dropdown">
          <input class="dropdown__input" type="text" placeholder="search" v-model="searchPhrase"
                 v-on:change="searchPhraseChange()">
          <div class="dropdown__list">
            <div class="dropdown__option"
                 v-for="(assetOption, key) in displayedOptions"
                 v-bind:key="assetOption.symbol + key"
                 v-on:click="selectOption(assetOption)">
              <img
                  class="option__icon"
                  :src="`src/assets/logo/${assetOption.symbol.toLowerCase()}.${assetOption.logoExt ? assetOption.logoExt : 'svg'}`"
              >
              <div class="option__symbol">{{assetOption.short ? assetOption.short : assetOption.symbol}}</div>
              <div class="option__name">{{assetOption.name}}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script>
import CurrencyInput from './CurrencyInput';
import DeltaIcon from './DeltaIcon.vue';
import {ContentLoader} from 'vue-content-loader';

export default {
  name: 'AssetDropdown',
  components: {
    DeltaIcon,
    CurrencyInput,
    ContentLoader
  },
  props: {
    assetOptions: {},
    defaultAsset: null,
    infoIconMessage: null,
    disabled: false,
  },
  computed: {
  },
  data() {
    return {
      expanded: false,
      hasBackground: false,
      displayedOptions: [],
      selectedAsset: null,
      searchPhrase: null
    };
  },
  mounted() {
  },
  methods: {
    toggleSelect() {
      setTimeout(() => {
        console.log('toggle select');
        if (this.expanded) {
          this.closeDropdown();
        } else {
          this.openDropdown();
        }
      });
    },

    closeDropdown() {
      this.expanded = false;
      setTimeout(() => {
        this.hasBackground = false;
      }, 200);
    },

    openDropdown() {
      this.expanded = true;
      this.hasBackground = true;
    },

    setupDisplayedOptions() {
      this.displayedOptions  = Object.values(this.assetOptions);

      this.setSelectedAsset(this.defaultAsset, true);
      if (!this.selectedAsset) {
        this.selectOption(this.displayedOptions[0]);
        this.emitValue();
      }
    },

    searchOptions(searchPhrase) {
      let assetOptions = this.assetOptions;
      
      if (searchPhrase) {
        return assetOptions.filter(
          assetOption => assetOption.symbol.toUpperCase().includes(searchPhrase.toUpperCase()) ||
            assetOption.name.toUpperCase().includes(searchPhrase.toUpperCase()));
      } else {
        return assetOptions;
      }
    },

    searchPhraseChange() {
      this.displayedOptions = this.searchOptions(this.searchPhrase);
    },

    selectOption(option) {
      this.selectedAsset = option;
      this.emitValue();
      if (this.expanded) {
        this.toggleSelect();
      }
    },

    dropdownPanelClick() {
      if (this.expanded) {
        this.closeDropdown();
      }
    },

    setSelectedAsset(asset, disableEmitValue) {
      this.selectedAsset = this.displayedOptions.find(option => option.symbol === asset);
      if (!disableEmitValue) {
        this.emitValue();
      }
    },

    async emitValue() {
      this.$emit('valueChange', {
        chosen: this.selectedAsset.symbol
      });
    },
  },
  watch: {
    searchPhrase: {
      handler() {
        this.searchPhraseChange();
      },
    },

    assetOptions: {
      handler() {
        console.log('and here')
        console.log(this.assetOptions)
        if (this.assetOptions) {
          this.setupDisplayedOptions();
        }
      },
      immediate: true
    }
  }
};
</script>
<style lang="scss" scoped>
@import "~@/styles/variables";

.asset-dropdown-component {

  .asset-dropdown {
    display: flex;
    flex-direction: row;
    align-items: center;
    box-shadow: var(--asset-dropdown__box-shadow);
    background-image: var(--asset-dropdown__background);
    height: 60px;
    border-radius: 15px;

    .currency-input {
      width: 386px;
    }

    .info__icon.message {
      width: 22px;
    }

    .divider {
      min-width: 2px;
      height: 34px;
      background-color: var(--asset-dropdown__divider-color);
    }

    .select {
      position: relative;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px 0 16px;
      flex: 1;

      .selected-asset {
        display: flex;
        flex-direction: row;
        align-items: center;
        min-width: 105px;

        .selected-asset__icon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          margin-right: 10px;
        }

        .selected-asset__symbol {
          font-weight: 700;
          font-size: $font-size-sm;
          flex-grow: 1;
        }
      }

      .placeholder {
        flex: 1;
        font-weight: 500;
        color: var(--asset-dropdown__select-dropdown-placeholder-font-color);
        font-family: 'Montserrat', sans-serif;
      }

      .chevron {
        background: var(--asset-dropdown__chevron-color);
        cursor: pointer;
        transition: transform 200ms ease-in-out;
      }

      .dropdown-panel {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: -1;
      }

      .select-dropdown {
        position: fixed;
        transform: translate(-16px, calc(50% + 36px));
        display: flex;
        flex-direction: column;
        width: 311px;
        height: 0;
        border-radius: 15px;
        border-style: solid;
        border-width: 2px;
        border-color: transparent;
        background-color: transparent;
        overflow-y: hidden;
        transition: height 200ms ease-in-out;
        z-index: 2;

        .select-title {
          padding: 10px 16px;
          font-size: $font-size-sm;
          color: var(--asset-dropdown__select-dropdown-select-title-color);
        }
        

        .dropdown__input {
          border: none;
          outline: none;
          background: none;
          padding: 10px 0 10px 16px;
          font-size: $font-size-sm;
          font-weight: 700;
          text-transform: uppercase;
          font-family: 'Montserrat', sans-serif;
          border-bottom: var(--asset-dropdown__select-dropdown-input-border);
        }

        .dropdown__list {
          display: flex;
          flex-direction: column;
          padding-top: 7px;
          height: 234px;
          overflow-y: scroll;

          &::-webkit-scrollbar {
            display: none;
          }


          .dropdown__option {
            display: flex;
            flex-direction: row;
            flex-shrink: 0;
            align-items: center;
            padding: 0 14px;
            height: 48px;
            cursor: pointer;
            transition: background-color 50ms ease-in-out;

            &:hover {
              background-color: var(--asset-dropdown__select-dropdown-option-background--hover);
            }

            .option__icon {
              width: 34px;
              height: 34px;
              margin-right: 10px;
              opacity: var(--asset-dropdown__select-dropdown-option-icon-opacity);
              border-radius: 999px;
            }

            .option__alt-icon {
              display: flex;
              justify-content: center;
              align-items: center;
              background-color: $deep-gray;
            }

            .option__symbol {
              font-size: $font-size-sm;
              font-weight: 700;
              text-transform: uppercase;
              margin-right: 10px;
            }

            .option__name {
              flex: 1;
              font-size: $font-size-sm;
              color: var(--asset-dropdown__select-dropdown-option-name-color);
            }

            .content-loader {
              display: flex;
              width: 40px;
              height: 8px;
              border-radius: 10px;
            }
          }
        }
      }

      &.expanded {
        .chevron {
          transform: rotate(-180deg);
        }

        .select-dropdown {
          display: flex;
          height: 278px;
        }
      }

      &.has-background {

        .select-dropdown {
          border-color: var(--asset-dropdown__select-dropdown-border-color);
          background-color: var(--asset-dropdown__select-dropdown-background);
        }
      }
    }
  }
}

</style>
