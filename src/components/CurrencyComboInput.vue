<template>
  <div class="currency-combo-input-component" v-if="displayedOptions">
    <div class="combo-input">
      <CurrencyInput ref="currencyInput"
                     class="currency-input"
                     :embedded="true"
                     :validators="validators"
                     :warnings="warnings"
                     :info="info"
                     :disabled="disabled"
                     :typingTimeout="typingTimeout"
                     v-on:newValue="onCurrencyInputNewValue"
                     v-on:inputChange="currencyInputChange"
                     v-on:ongoingTyping="ongoingTyping"
                     :max="max"
                     :info-icon-message="infoIconMessage"
                     :delay-error-check-after-value-propagation="true">
      </CurrencyInput>
      <div class="divider"></div>
      <div class="select" v-bind:class="{'expanded': expanded, 'has-background': hasBackground }">
        <div v-if="selectedAsset" class="selected-asset">
          <img class="selected-asset__icon" :src="selectedAsset.logo ? selectedAsset.logo : selectedAsset.logoURI">
          <div class="selected-asset__symbol">{{selectedAsset.short ? selectedAsset.short : selectedAsset.symbol}}</div>
        </div>
        <div v-if="isBridge && !selectedAsset" class="placeholder">Select chain and token</div>
        <DeltaIcon class="chevron"
                   :icon-src="'src/assets/icons/chevron-down.svg'"
                   :size="21"
                   v-on:click.native="toggleSelect()"
                   v-if="displayedOptions && displayedOptions.length > 0 && assetOptions.length > 1">
        </DeltaIcon>
        <div class="dropdown-panel" v-if="expanded" v-on:click="dropdownPanelClick()"></div>
        <div
            class="select-dropdown"
            :style="{'width': isBridge ? '430px' : '', 'height': isBridge && expanded ? '400px' : ''}"
        >
          <div v-if="isBridge" class="select-title">Select chain</div>
          <div v-if="isBridge" class="available-chains">
            <div
                v-for="chain of availableChains"
                v-bind:key="chain.id"
                :class="['chain', { active: selectedChain == chain }]"
                v-on:click="selectChain(chain)"
                v-tooltip="{content: chain.name, classes: 'info-tooltip'}"
            >
              <img :src="chain.logoURI" class="chain-logo">
            </div>
          </div>
          <input class="dropdown__input" type="text" placeholder="search" v-model="searchPhrase"
                 v-on:change="searchPhraseChange()">
          <div class="dropdown__list">
            <div class="dropdown__option"
                 v-for="(assetOption, key) in displayedOptions"
                 v-bind:key="assetOption.symbol + key"
                 v-on:click="selectOption(assetOption)">
              <img
                  v-if="assetOption.logo || assetOption.logoURI"
                  class="option__icon"
                  :src="assetOption.logo ? assetOption.logo : assetOption.logoURI"
              >
              <div
                  v-if="!assetOption.logo && !assetOption.logoURI"
                  class="option__icon option__alt-icon"
              >{{assetOption.name.charAt(0)}}
              </div>
              <div class="option__symbol">{{assetOption.short ? assetOption.short : assetOption.symbol}}</div>
              <div class="option__name">{{assetOption.name}}</div>
              <ContentLoader
                  v-if="isBridge && (!assetsBalances[selectedChain.id] || assetsBalances[selectedChain.id].length !== displayedOptions.length)"
                  class="content-loader"
                  :width="40"
                  :height="8"
                  :primaryColor="'#9eacdf'"
                  :secondaryColor="'#9eacdf'"
                  :primaryOpacity="0.4"
                  :secondaryOpacity="0.2"
              ></ContentLoader>
              <div
                  v-if="isBridge && assetsBalances[selectedChain.id] && assetsBalances[selectedChain.id].length === displayedOptions.length"
                  class="option__balance"
              >
                <div
                    v-if="Number(assetsBalances[selectedChain.id][key].amount) > 0"
                    class="balance__amount"
                >{{assetsBalances[selectedChain.id][key].amount|smartRound(4)}}
                </div>
                <div
                    v-if="Number(assetsBalances[selectedChain.id][key].amount) > 0"
                    class="balance__usd"
                >{{assetsBalances[selectedChain.id][key].amount * assetsBalances[selectedChain.id][key].priceUSD|usd}}
                </div>
              </div>
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
import DeltaIcon from './DeltaIcon.vue';
import {ContentLoader} from 'vue-content-loader';

export default {
  name: 'CurrencyComboInput',
  components: {
    DeltaIcon,
    CurrencyInput,
    ContentLoader
  },
  props: {
    isBridge: {
      type: Boolean, default: false
    },
    availableChains: {
      type: Array, default: () => []
    },
    assetOptions: {},
    assetsBalances: {
      type: Object, default: () => {
      }
    },
    defaultAsset: null,
    max: {},
    infoIconMessage: null,
    validators: {
      type: Array, default: () => []
    },
    warnings: {
      type: Array, default: () => []
    },
    //TODO: make an array like in validators
    info: {type: Function, default: null},
    disabled: false,
    typingTimeout: {type: Number, default: 0}
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
      selectedChain: null,
      selectedAsset: null,
      searchPhrase: null,
      assetAmount: null,
      maxButtonUsed: false
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

    setupDisplayedAssetOptions() {
      if (this.isBridge && this.availableChains && this.availableChains.length > 0) {
        let assetOptions;

        if (this.selectedChain && Object.hasOwn(this.assetOptions, this.selectedChain.id)) {
          assetOptions = this.assetOptions[this.selectedChain.id];
        } else {
          assetOptions = this.assetOptions[Object.keys(this.assetOptions)[0]];
        }

        this.displayedOptions = JSON.parse(JSON.stringify(assetOptions));

        if (this.selectedChain) {
          this.$emit('chainChange', {
            chainId: this.selectedChain.id,
            tokens: assetOptions
          });
        }
      } else {
        this.displayedOptions = JSON.parse(JSON.stringify(this.assetOptions));
        this.setSelectedAsset(this.defaultAsset, true);
        if (!this.selectedAsset) {
          this.selectOption(this.displayedOptions[0]);
          this.emitValue();
        }
      }
    },

    searchOptions(searchPhrase) {
      let assetOptions = this.assetOptions;

      if (this.isBridge) {
        assetOptions = this.assetOptions[this.selectedChain.id];
      }

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

    selectChain(chain) {
      this.selectedChain = chain;
      this.setupDisplayedAssetOptions();
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

    currencyInputChange(value, disableEmitValue) {
      this.assetAmount = value;
      if (!disableEmitValue) {
        this.emitValue();
      }
    },

    onCurrencyInputNewValue(event) {
      this.maxButtonUsed = event.maxButtonUsed;
    },

    ongoingTyping(event) {
      this.$emit('ongoingTyping', {typing: event.typing});
    },

    async emitValue() {
      const error = await this.$refs.currencyInput.forceValidationCheck();
      this.$emit('valueChange', {
        chain: this.isBridge ? this.selectedChain : null,
        asset: this.selectedAsset.symbol,
        value: Number(this.assetAmount),
        error: error,
        maxButtonUsed: this.maxButtonUsed
      });
    },

    setCurrencyInputValue(value) {
      return this.$refs.currencyInput.setValue(value);
    },

    forceValidationCheck() {
      this.$refs.currencyInput.forceValidationCheck();
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

    availableChains: {
      handler(chains) {
        this.selectedChain = chains.find(chain => chain.id === config.chainId);
        this.setupDisplayedAssetOptions();
      }
    }
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
    box-shadow: var(--currency-combo-input__box-shadow);
    background-image: var(--currency-combo-input__background);
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
      background-color: var(--currency-combo-input__divider-color);
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
        color: var(--currency-combo-input__select-dropdown-placeholder-font-color);
        font-family: 'Montserrat', sans-serif;
      }

      .chevron {
        background: var(--currency-combo-input__chevron-color);
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
          color: var(--currency-combo-input__select-dropdown-select-title-color);
        }

        .available-chains {
          border-top: var(--currency-combo-input__select-dropdown-chains-border);
          border-bottom: var(--currency-combo-input__select-dropdown-chains-border);
          padding: 10px 16px;
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;

          .chain {
            display: flex;
            justify-content: center;
            align-items: center;
            border: var(--currency-combo-input__select-dropdown-chain-item-border);
            border-radius: 999px;
            padding: 3.5px;
            cursor: pointer;

            &:hover {
              opacity: 0.9;
            }

            &.active {
              border: var(--currency-combo-input__select-dropdown-chain-item-border-active);
            }

            .chain-logo {
              border-radius: 999px;
              width: 100%;
            }
          }
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
          border-bottom: var(--currency-combo-input__select-dropdown-input-border);
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
              background-color: var(--currency-combo-input__select-dropdown-option-background--hover);
            }

            .option__icon {
              width: 34px;
              height: 34px;
              margin-right: 10px;
              opacity: var(--currency-combo-input__select-dropdown-option-icon-opacity);
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
              color: var(--currency-combo-input__select-dropdown-option-name-color);
            }

            .content-loader {
              display: flex;
              width: 40px;
              height: 8px;
              border-radius: 10px;
            }

            .option__balance {
              display: flex;
              flex-direction: column;
              align-items: end;

              .balance__amount {
                font-size: $font-size-sm;
                font-weight: 600;
              }

              .balance__usd {
                font-size: $font-size-xs;
                font-weight: 500;
              }
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
          border-color: var(--currency-combo-input__select-dropdown-border-color);
          background-color: var(--currency-combo-input__select-dropdown-background);
        }
      }
    }
  }
}

</style>
