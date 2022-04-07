<template>
  <div class="list">
    <div class="title">Staking</div>
    <div class="total">
        <span class="total-value-wrapper">
          <span class="total-value">
            Total staked: <span class="value">$ {{ avaxToUSD(totalValue).toFixed(2) || usd }}</span>
          </span>
        </span>
    </div>

    <div class="table">
      <div class="table__header">
        <div class="table__cell left">Pool</div>
        <div class="table__cell right">Total staked</div>
        <div class="table__cell trend left">APR</div>
        <div class="table__cell"></div>
        <div class="table__cell"></div>
        <div class="table__cell"></div>
        <div class="table__cell right">View</div>
      </div>
      <div class="table__body">
        <div class="table__row" v-for="pool in pools"
             v-bind:key="pool.poolName">
          <div class="table__cell left" data-label="Pool">
            <div class="token-logo-wrapper">
              <img :src="logoSrc(pool.symbol)" class="token-logo"/>
            </div>
            <span class="token-name">{{ pool.name }}</span>
          </div>
          <div class="table__cell right" data-label="Total Staked">
            <span>{{pool.totalStaked}}</span>
          </div>
          <div class="table__cell center" data-label="APR">
            <span>{{pool.apr | percent}}</span>
          </div>
          <div class="table__cell" v-if="!isMobile"></div>
          <div class="table__cell" v-if="!isMobile"></div>
          <div class="table__cell" v-if="!isMobile"></div>
          <div>
            <div class="table__cell invest-buttons right" @click.stop>
              <img @click="showStakingOptions(pool.poolName)" class="chevron clickable-icon"/>
            </div>
          </div>

          <div class="staking-table" v-if="pool.showStakingOptions" @click.stop>
            <div class="staking-options-table">
              <div class="table nested-table">
                <div class="table__header">
                  <div class="table__cell left">Asset</div>
                  <div class="table__cell right">Price</div>
                  <div class="table__cell trend left">Staked</div>
                  <div class="table__cell right"></div>
                  <div class="table__cell right"></div>
                  <div class="table__cell right"></div>
                  <div class="table__cell right">Stake/Unstake</div>
                </div>
                <div class="table__body">
                  <div class="table__row" v-for="asset in pool.stakingOptions"
                       v-bind:key="asset.symbol">
                    <div class="table__cell left" data-label="Asset">
                      <div class="token-logo-wrapper">
                        <img :src="logoSrc(asset.symbol)" class="token-logo"/>
                      </div>
                      <span class="token-name">{{ asset.name }}</span>
                    </div>
                    <div class="table__cell right" data-label="Price">
                      <LoadedValue :check="() => asset.price != null" :value="asset.price | usd"></LoadedValue>
                    </div>
                    <div class="table__cell center" data-label="Staked">
                      <span>11.235</span>
                    </div>
                    <div class="table__cell" v-if="!isMobile"></div>
                    <div class="table__cell" v-if="!isMobile"></div>
                    <div class="table__cell" v-if="!isMobile"></div>
                    <div>
                      <div class="table__cell invest-buttons right" @click.stop>
                        <img class="plus clickable-icon"/>
                        <img src="src/assets/icons/slash-small.svg"/>
                        <img class="minus clickable-icon"/>
                      </div>
                    </div>
                  </div>
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
import Chart from "@/components/Chart.vue";
import SimpleChart from "@/components/SimpleChart.vue";
import Block from "@/components/Block.vue";
import CurrencyForm from "@/components/CurrencyForm.vue";
import SmallBlock from "@/components/SmallBlock.vue";
import LoadedValue from "@/components/LoadedValue.vue";
import Button from "@/components/Button.vue";
import {mapState, mapActions, mapGetters} from "vuex";
import redstone from 'redstone-api';
import Vue from 'vue'
import config from "@/config";
import {maxAvaxToBeSold, acceptableSlippage} from "../utils/calculate";


export default {
  name: 'StakingList',
  components: {
    Chart,
    Block,
    CurrencyForm,
    SimpleChart,
    SmallBlock,
    LoadedValue,
    Button
  },
  props: {
  },
  computed: {
    ...mapState('loan', ['totalValue', 'assets', 'loanHistory']),
    ...mapGetters('loan', ['getCurrentCollateral', 'getProfit']),
  },
  data() {
    return {
      list: config.ASSETS_CONFIG,
      pools: {
        'YAK_POOL': {
          poolName: 'YAK_POOL',
          symbol: 'YAK',
          name: 'Yak',
          totalStaked: 1.2,
          balance: 1,
          apr: 0.053,
          showStakingOptions: false,
          stakingOptions: [
              config.ASSETS_CONFIG.AVAX
          ]
        }
      }
    }
  },
  methods: {
    showStakingOptions(poolName) {
      Vue.set(this.pools[poolName], 'showStakingOptions', !this.pools[poolName].showStakingOptions);
    },
  },
}
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.list-wrapper {
  @media screen and (max-width: $md) {
    width: 70%;
    min-width: 300px;
  }
}

.list {
  width: 100%;
}

.staking-table {
  grid-column: 1/-1;
}

.nested-table {
  padding: 0 20px ;

  .table__header {
    margin-bottom: 0;
  }
}

.element {
  padding: 15px 0;
  border-style: solid;
  border-width: 2px 0 0 0;
  border-image-source: linear-gradient(91deg, rgba(223, 224, 255, 0.43), rgba(255, 225, 194, 0.62), rgba(255, 211, 224, 0.79));
  border-image-slice: 1;
  font-weight: 500;

  .row {
    display: flex;
    justify-content: space-between;
  }
}

.title {
  font-size: 24px;
  font-weight: bold;
  width: 100%;
  text-align: center;
}

.total {
  margin-top: 30px;
  width: 100%;
  text-align: center;

  .total-value-wrapper {
    background-image: linear-gradient(117deg, #dfe0ff 39%, #ffe1c2 62%, #ffd3e0 82%);
    border-radius: 25px;
    display: inline-block;
    height: 41px;
    padding: 9px 2px 3px;

    @media screen and (min-width: $md) {
      height: 44px;
      padding: 12px 2px 2px;

    }
  }

  .total-value {
    background: white;
    padding: 10px 2px;
    border-radius: 21px;
    font-size: 14px;

    @media screen and (min-width: $md) {
      font-size: 18px;
      padding: 9px 20px;
    }

    .value {
      font-weight: 500;

      &.red {
        color: $red;
      }
    }

    .vertical-line {
      width: 3px;
      height: 17px;
      margin: 3px 5px 2px 5px;
      border-left: solid 2px #dadada;

      @media screen and (min-width: $md) {
        margin: 3px 18px 2px 19px;
      }
    }
  }
}

.options {
  margin-top: 40px;
}

.chart-icon {
  text-align: right;
  margin-left: 40px;
  display: none;
  cursor: pointer;

  @media screen and (min-width: $md) {
    display: flex;
  }

  img {
    height: 22px;
    margin-left: 5px;
  }
}

.invest-buttons {
  display: flex;
  justify-content: center;

  .plus {
    content: url(../assets/icons/plus.svg);

    &:hover {
      content: url(../assets/icons/hover/plus.svg);
    }
  }

  .minus {
    content: url(../assets/icons/minus.svg);

    &:hover {
      content: url(../assets/icons/hover/minus.svg);
    }
  }

  .chevron {
    content: url(../assets/icons/chevron-down.svg);
  }


}

.enlarge {
  content: url(../assets/icons/enlarge.svg);

  &:hover {
    content: url(../assets/icons/hover/enlarge.svg);
  }
}

.no-buy {
  margin-right: 30px;
  justify-content: flex-end;
}

.clickable {
  cursor: pointer;
}

.token-logo {
  height: 20px;

  @media screen and (max-width: $md) {
    height: 24px;
  }
}

.token-logo-wrapper {
  display: inline-block;
  width: 30px;
}

.token-name {
  font-weight: 500;
}

.chart, .asset-input {
  display: grid;
  grid-column: 1/-1;
  margin-top: 2rem;
  margin-bottom: 2rem;
  height: 230px;
}

.asset-input {
  display: block;
}

.big-chart {
  width: 86%;
  align-self: center;
}

@media screen and (max-width: $md - 1) {
  .invest-buttons {
    display: inline-block;
    border-bottom: none;
    text-align: start;
  }

  .chart-icon {
    display: none;
  }

  .invest-buttons {
    width: 100%;
    text-align: center;

    @media screen and (min-width: $md) {
      width: 65%;
      text-align: start;
    }
  }

  .asset-input {
    border: none;
    justify-content: center;

    @media screen and (min-width: $md) {
      justify-content: inherit;
    }
  }
}

.chart-loader {
  display: flex;
  justify-content: center;
}

</style>

<style lang="scss">
@import "~@/styles/variables";

.table {
  display: flex;
  flex-direction: column;
  margin-top: 45px;

  &.nested-table {
    margin-top: 0;
  }

  .table__header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    padding: 0 10px 0 10px;
    font-weight: 500;
    color: $dark-gray;
    margin-bottom: 1rem;

    @media screen and (max-width: $md) {
      display: none;
    }
  }

  .table__body {
    display: flex;
    flex-direction: column;

    .table__row {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      padding: 0 10px 0 10px;
      border-style: solid;
      border-width: 2px 0 0 0;
      border-image-source: linear-gradient(to right, #dfe0ff 43%, #ffe1c2 62%, #ffd3e0 79%);
      border-image-slice: 1;

      @media screen and (max-width: $md) {
        grid-template-columns: repeat(1, 1fr);
        margin-bottom: 1.5em;
      }

      .table__cell {
        min-height: 55px;

        @media screen and (max-width: $md) {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          border-bottom: 1px solid $light-gray;
          font-size: .8em;
          text-align: right;
          padding: 0.5rem 0;

          &.chart-icon {
            display: none;
          }

          &::before {
            content: attr(data-label);
            float: left;
            font-weight: bold;
          }

          &:last-child {
            border-bottom: none;
          }

        }

        &.invest-buttons {
          @media screen and (max-width: $md) {
            justify-content: center;
          }
        }
      }

      .asset-input .small-block-wrapper {
        height: 100%;
      }
    }
  }
}

.table__cell {
  flex-grow: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: center;
  font-weight: 500;
  padding: 1px;

  &.trend {
    margin-left: 40px;
  }

  &.value {
    font-weight: 600;
  }

  &.right {
    text-align: right;
    justify-content: flex-end;
  }

  &.left {
    text-align: left;
    justify-content: flex-start;
  }

  &.center {
    text-align: center;
    justify-content: center;
  }
}

.asset-input {
  .currency-form-wrapper {
    width: 100%;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-start;

    @media screen and (min-width: $md) {
      flex-wrap: nowrap;
      align-items: flex-start;
      align-self: center;
      width: min-content;
      margin-top: 45px;
    }


    .input-wrapper {
      height: 60px;
    }

    input {
      height: 30px;
      line-height: 30px;
    }

    .error, .info, .warning {
      text-align: left;
    }

    .logo {
      height: 30px;
      width: 30px;
      min-width: 30px;
      min-height: 30px;
    }

    .symbol {
      font-size: 16px;
    }

    .btn {
      padding: 13px 20px;
      margin-left: 30px;
      font-size: 20px;

      &.waiting .ball-beat:not(.active) {
        margin-top: 5px;
        margin-bottom: 5px;
      }
    }

    .value-wrapper .label {
      text-align: start;
    }

    .form-button {
      margin-bottom: 30px;
    }
  }
}

</style>
