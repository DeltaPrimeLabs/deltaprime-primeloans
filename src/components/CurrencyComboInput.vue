<template>
  <div class="currency-combo-input-component" v-if="displayedOptions && displayedOptions.length > 0">
    <div class="combo-input">
<!--      <button v-on:click="test()">test</button>-->
      <CurrencyInput ref="currencyInput" class="currency-input" :embedded="true" v-on:inputChange="currencyInputChange"></CurrencyInput>
      <div class="divider"></div>
      <div class="select" v-bind:class="{'expanded': expanded, 'has-background': hasBackground }">
        <div v-if="selectedAsset" class="selected-asset">
          <img class="selected-asset__icon" :src="selectedAsset.logo">
          <div class="selected-asset__symbol">{{ selectedAsset.symbol }}</div>
        </div>
        <img class="chevron" src="src/assets/icons/chevron-down.svg" v-on:click="toggleSelect()">
        <div class="dropdown-panel" v-if="expanded" v-on:click="dropdownPanelClick()"></div>
        <div class="select-dropdown">
          <input class="dropdown__input" type="text" placeholder="search" v-model="searchPhrase"
                 v-on:change="searchPhraseChange()">
          <div class="dropdown__list">
            <div class="dropdown__option"
                 v-for="assetOption in displayedOptions"
                 v-bind:key="assetOption.symbol"
                 v-on:click="selectOption(assetOption)">
              <img class="option__icon" :src="assetOption.logo">
              <div class="option__symbol">{{ assetOption.symbol }}</div>
              <div class="option__name">{{ assetOption.name }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script>
import CurrencyInput from './CurrencyInput';
import config from '../config';

export default {
  name: 'CurrencyComboInput',
  components: {
    CurrencyInput
  },
  props: {
    assetOptions: {}
  },
  computed: {
    getDisplayedAssetOptions() {
      return this.displayedOptions;
    }
  },
  data() {
    return {
      expanded: false,
      hasBackground: false,
      displayedOptions: [],
      selectedAsset: null,
      searchPhrase: null,
      assetAmount: null,
    };
  },
  mounted() {
  },
  methods: {
    toggleSelect() {
      if (this.expanded) {
        this.closeDropdown();
      } else {
        this.openDropdown();
      }
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

    setupDisplayedAssetOptions() {
      this.displayedOptions = JSON.parse(JSON.stringify(this.assetOptions));
    },

    searchOptions(searchPhrase) {
      if (searchPhrase) {
        return this.assetOptions.filter(
          assetOption => assetOption.symbol.toUpperCase().includes(searchPhrase.toUpperCase()) ||
            assetOption.name.toUpperCase().includes(searchPhrase.toUpperCase()));
      } else {
        return this.assetOptions;
      }
    },

    searchPhraseChange() {
      this.displayedOptions = this.searchOptions(this.searchPhrase);
    },

    selectOption(option) {
      this.selectedAsset = option;
      this.emitValue();
      this.toggleSelect();
    },

    dropdownPanelClick() {
      if (this.expanded) {
        this.closeDropdown();
      }
    },

    test() {
    },

    setSelectedAsset(asset, disableEmitValue) {
      this.selectedAsset = this.displayedOptions.find(option => option.symbol === asset);
      if (!disableEmitValue) {
        this.emitValue();
      }
    },

    currencyInputChange(value, disableEmitValue) {
      this.assetAmount = value;
      if (!disableEmitValue) {
        this.emitValue();
      }
    },

    emitValue() {
      this.$emit('valueChange', {asset: this.selectedAsset.symbol, value: this.assetAmount});
    },

    setCurrencyInputValue(value) {
      this.$refs.currencyInput.setValue(value)
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
        this.setupDisplayedAssetOptions();
      }
    },
  }
};
</script>
<style lang="scss" scoped>
@import "~@/styles/variables";

.currency-combo-input-component {

  .combo-input {
    display: flex;
    flex-direction: row;
    align-items: center;
    box-shadow: inset 3px 3px 8px rgba(191, 188, 255, 0.5);
    background-image: linear-gradient(114deg, rgba(115, 117, 252, 0.08) 39%, rgba(255, 162, 67, 0.08) 62%, rgba(245, 33, 127, 0.08) 81%);
    height: 60px;
    border-radius: 15px;

    .currency-input {
      width: 386px;
    }

    .divider {
      width: 2px;
      height: 34px;
      background-color: $light-violet;
    }

    .select {
      position: relative;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px 0 16px;
      flex-grow: 1;

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
          font-weight: 900;
          font-size: $font-size-md;
          flex-grow: 1;
        }
      }

      .chevron {
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
        position: absolute;
        top: 52px;
        left: 0;
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

        .dropdown__input {
          border: none;
          outline: none;
          background: none;
          padding: 10px 0 10px 16px;
          font-size: $font-size-md;
          font-weight: 900;
          text-transform: uppercase;
          font-family: 'Montserrat', sans-serif;
          border-bottom: 2px solid $smoke-gray;
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
            padding-left: 14px;
            height: 48px;
            cursor: pointer;
            transition: background-color 50ms ease-in-out;

            &:hover {
              background-color: $fog-gray;
            }

            .option__icon {
              width: 34px;
              height: 34px;
              margin-right: 10px;
            }

            .option__symbol {
              font-size: $font-size-md;
              font-weight: 900;
              text-transform: uppercase;
              margin-right: 10px;
            }

            .option__name {
              font-size: $font-size-md;
              color: $medium-gray;
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
          border-color: $delta-light;
          background-color: white;
        }
      }
    }
  }
}

</style>
