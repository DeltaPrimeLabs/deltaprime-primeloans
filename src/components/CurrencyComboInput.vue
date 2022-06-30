<template>
  <div class="currency-combo-input-component">
    <div class="combo-input">
      <CurrencyInput class="currency-input" :embedded="true"></CurrencyInput>
      <div class="divider"></div>
      <div class="select" v-bind:class="{'expanded': expanded, 'has-background': hasBackground }">
        <div class="selected-asset">
          <img class="selected-asset__icon" src="src/assets/logo/btc.svg">
          <div class="selected-asset__symbol">BTC</div>
        </div>
        <img class="chevron" src="src/assets/icons/chevron-down.svg" v-on:click="toggleSelect()">
        <div class="select-dropdown">
          <input class="dropdown__input" type="text" placeholder="search">
          <div class="dropdown__list">
            <div class="dropdown__option">
              <img class="option__icon" src="src/assets/logo/btc.svg">
              <div class="option__symbol">BTC</div>
              <div class="option__name">Bitcoin</div>
            </div>

            <div class="dropdown__option">
              <img class="option__icon" src="src/assets/logo/eth.svg">
              <div class="option__symbol">ETH</div>
              <div class="option__name">Ethereum</div>
            </div>

            <div class="dropdown__option">
              <img class="option__icon" src="src/assets/logo/usdc.svg">
              <div class="option__symbol">USDC</div>
              <div class="option__name">Usdc</div>
            </div>

            <div class="dropdown__option">
              <img class="option__icon" src="src/assets/logo/avax.svg">
              <div class="option__symbol">AVAX</div>
              <div class="option__name">Avalanche</div>
            </div>

            <div class="dropdown__option">
              <img class="option__icon" src="src/assets/logo/yak.svg">
              <div class="option__symbol">YAK</div>
              <div class="option__name">Yeild yak</div>
            </div>

            <div class="dropdown__option">
              <img class="option__icon" src="src/assets/logo/usdt.svg">
              <div class="option__symbol">USDT</div>
              <div class="option__name">Tether</div>
            </div>

            <div class="dropdown__option">
              <img class="option__icon" src="src/assets/logo/png.svg">
              <div class="option__symbol">PNG</div>
              <div class="option__name">Pangolin</div>
            </div>

            <div class="dropdown__option">
              <img class="option__icon" src="src/assets/logo/qi.svg">
              <div class="option__symbol">QI</div>
              <div class="option__name">Benqi</div>
            </div>

            <div class="dropdown__option">
              <img class="option__icon" src="src/assets/logo/usdc.svg">
              <div class="option__symbol">USDC</div>
              <div class="option__name">Usdc</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script>
import CurrencyInput from './CurrencyInput';

export default {
  name: 'CurrencyComboInput',
  components: {
    CurrencyInput
  },
  props: {},
  computed: {},
  data() {
    return {
      expanded: false,
      hasBackground: false,
    };
  },
  methods: {
    toggleSelect() {
      if (this.expanded) {
        this.expanded = false;
        setTimeout(() => {
          this.hasBackground = false
        }, 200);
      } else {
        this.expanded = true;
        this.hasBackground = true;
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
        border-color: $delta-light;
        background-color: white;
      }
    }
  }
}

</style>
