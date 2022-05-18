<template>
  <div class="list-wrapper">
    <div class="list">
      <div class="title">Your investments</div>
      <div class="total">
        <span class="total-value-wrapper">
          <span class="total-value">
            Total value: <span class="value">$ {{ avaxToUSD(totalValue).toFixed(2) || usd }}</span>
            <span class="vertical-line"></span>
            Your {{ profit >= 0 ? 'profit' : 'loss' }}: <span class="value" :class="{'red': profit < 0}">
            {{ (profit !== null && avaxPrice) ? profit.toFixed(2) : '' }}
            <img class="profit-avax-logo" src="src/assets/icons/avax-icon.svg">
          </span>
          </span>
        </span>
      </div>

      <div class="table">
        <div class="table__header">
          <div class="table__cell left">Asset</div>
          <div class="table__cell right">Price</div>
          <div class="table__cell trend left">Trend</div>
          <div class="table__cell right">Balance</div>
          <div class="table__cell right">Share</div>
          <div class="table__cell right">Value</div>
          <div class="table__cell right">Buy/Sell</div>
        </div>
        <div class="table__body">
          <div class="table__row" v-for="asset in investments"
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
            <div class="table__cell center chart-icon"
                 data-label="Chart"
                 @click.stop="toggleChart(asset.symbol)"
            >
              <SimpleChart
                class="simple-chart"
                :dataPoints="asset.prices"
                :isStableCoin="asset.isStableCoin"
                :lineWidth="1.5"/>
              <img class="enlarge clickable-icon"/>
            </div>
            <div class="table__cell right" data-label="Balance">
              <LoadedValue
                :check="() => asset.balance != null"
                :value="formatTokenBalance(asset.balance)">
              </LoadedValue>
            </div>
            <div class="table__cell right" data-label="Share">
              <LoadedValue :value="asset.share | percent"></LoadedValue>
            </div>
            <div class="table__cell value right" data-label="Value">
              <LoadedValue :value="asset.value | usd"></LoadedValue>
            </div>
            <div>
              <div class="table__cell invest-buttons right" @click.stop v-if="asset.symbol !== nativeToken">
                <img @click="showBuyInput(asset.symbol)" class="plus clickable-icon"/>
                <img src="src/assets/icons/slash-small.svg"/>
                <img @click="showSellInput(asset.symbol)" class="minus clickable-icon"/>
              </div>
              <div v-else class="table__cell right no-buy">-</div>
            </div>
            <div class="asset-input" v-if="asset.buyInput" @click.stop>
              <SmallBlock
                v-on:close="() => { asset.buyInput = false; }">
                <CurrencyForm
                  label="Buy"
                  :symbol="asset.symbol"
                  :slippage="asset.buySlippage"
                  :price="asset.price"
                  :hasSecondButton="true"
                  :waiting="asset.waiting"
                  :flexDirection="isMobile ? 'column' : 'row'"
                  :validators="investValidators(asset, list[nativeToken].balance)"
                  :warnings="investWarnings(asset.buySlippage)"
                  :info="buySlippageInfo(asset)"
                  :slim="true"
                  :showPriceInAvax="true"
                  v-on:submitValue="(value) => investValue(asset, value)"
                />
              </SmallBlock>
            </div>
            <div class="asset-input" v-if="asset.sellInput" @click.stop>
              <SmallBlock
                v-on:close="() => { asset.sellInput = false; }">
                <CurrencyForm
                  label="Sell"
                  :symbol="asset.symbol"
                  :slippage="-asset.sellSlippage"
                  :price="asset.price"
                  :hasSecondButton="true"
                  :waiting="asset.waiting"
                  :flexDirection="isMobile ? 'column' : 'row'"
                  :validators="redeemValidators(asset.balance)"
                  :warnings="redeemWarnings(asset)"
                  :info="sellSlippageInfo(asset)"
                  :max="asset.balance"
                  :slim="true"
                  :showPriceInAvax="true"
                  v-on:submitValue="(value) => redeemValue(asset, value)"
                />
              </SmallBlock>
            </div>
            <div class="chart" v-if="asset.showChart && asset.prices" @click.stop>
              <SmallBlock
                v-on:close="() => { asset.showChart = false; }">
                <div class="big-chart">
                  <Chart
                    :dataPoints="asset.prices"
                    :minY="asset.minPrice" :maxY="asset.maxPrice" lineWidth="3"/>
                </div>
              </SmallBlock>
            </div>
          </div>

          <div class="table__row" v-for="asset in investmentOptions"
               v-bind:key="asset.symbol">
            <div data-label="Asset" class="table__cell left">
              <div class="token-logo-wrapper">
                <img :src="logoSrc(asset.symbol)" class="token-logo"/>
              </div>
              <span class="token-name">{{ asset.name }}</span>
            </div>
            <div data-label="Price" class="table__cell right">
              <LoadedValue :check="() => asset.price != null" :value="asset.price | usd"></LoadedValue>
            </div>
            <div data-label="Chart" class="table__cell chart-icon"
                 @click.stop="toggleChart(asset.symbol)"
            >
              <SimpleChart
                :dataPoints="asset.prices"
                :isStableCoin="asset.isStableCoin"
                :lineWidth="1.5"/>
              <img class="enlarge clickable-icon"/>
            </div>
            <div class="table__cell" v-if="!isMobile"></div>
            <div class="table__cell" v-if="!isMobile"></div>
            <div class="table__cell" v-if="!isMobile"></div>
            <div class="table__cell invest-buttons right" @click.stop>
              <img v-if="asset.symbol !== nativeToken" @click="showBuyInput(asset.symbol)"
                   class="plus clickable-icon"/>
            </div>
            <div class="asset-input" v-if="asset.buyInput" @click.stop>
              <SmallBlock
                v-on:close="() => { asset.buyInput = false;  }">
                <CurrencyForm
                  label="Buy"
                  :symbol="asset.symbol"
                  :price="asset.price"
                  :hasSecondButton="true"
                  :slippage="asset.buySlippage"
                  v-on:submitValue="(value) => investValue(asset, value)"
                  v-on:changedValue="(value) => checkBuySlippage(asset, value)"
                  :waiting="asset.waiting"
                  :flexDirection="isMobile ? 'column' : 'row'"
                  :validators="investValidators(asset, list[nativeToken].balance)"
                  :warnings="investWarnings(asset.buySlippage)"
                  :info="buySlippageInfo(asset)"
                  :slim="true"
                  :showPriceInAvax="true"
                />
              </SmallBlock>
            </div>
            <div class="chart" v-if="asset.showChart && asset.prices" @click.stop>
              <SmallBlock
                v-on:close="() => { asset.showChart = false;  }">
                <div class="big-chart">
                  <Chart
                    :dataPoints="asset.prices"
                    :minY="asset.minPrice"
                    :maxY="asset.maxPrice"
                    :lineWidth="3"/>
                </div>
              </SmallBlock>
            </div>
          </div>
        </div>
      </div>
    </div>

    <StakingList></StakingList>

  </div>
</template>


<script>
import Chart from '@/components/Chart.vue';
import SimpleChart from '@/components/SimpleChart.vue';
import Block from '@/components/Block.vue';
import CurrencyForm from '@/components/CurrencyForm.vue';
import SmallBlock from '@/components/SmallBlock.vue';
import LoadedValue from '@/components/LoadedValue.vue';
import Button from '@/components/Button.vue';
import {mapActions, mapGetters, mapState} from 'vuex';
import redstone from 'redstone-api';
import Vue from 'vue';
import config from '@/config';
import {acceptableSlippage, maxAvaxToBeSold} from '../utils/calculate';
import StakingList from './StakingList';


export default {
  name: 'AssetsList',
  components: {
    StakingList,
    Chart,
    Block,
    CurrencyForm,
    SimpleChart,
    SmallBlock,
    LoadedValue,
    Button
  },
  props: {
    fields: [
      'Asset',
      'Price',
      'Balance',
      'Value',
      'Share',
      {key: 'actions', label: ''}
    ]
  },
  computed: {
    ...mapState('loan', ['totalValue', 'assets', 'loanHistory']),
    ...mapGetters('loan', ['getCurrentCollateral', 'getProfit']),
    ...mapState('network', ['account']),
    investments() {
      if (this.list) {
        return Object.values(this.list).filter(
          asset => {
            return asset.balance > 0 || asset.symbol === this.nativeToken;
          }
        );
      } else {
        return [];
      }
    },
    investmentOptions() {
      if (this.list) {
        return Object.values(this.list).filter(
          asset => {
            return (!asset.balance || asset.balance === 0) && asset.symbol !== this.nativeToken;
          }
        );
      } else {
        return [];
      }
    },
    nativeToken() {
      return config.nativeToken;
    },
    profit() {
      if (Math.abs(this.getProfit) < 0.01) {
        return 0;
      }
      return this.getProfit;
    }
  },
  data() {
    return {
      list: config.ASSETS_CONFIG,
    };
  },
  methods: {
    ...mapActions('loan', ['invest', 'redeem']),
    investValidators(asset, avaxBalance) {
      return [
        {
          validate: async (value) => {
            let slippage;
            try {
              slippage = await this.calculateSlippageForBuy(asset.symbol, asset.price, asset.decimals, asset.address, value);
              this.updateAsset(asset.symbol, 'buySlippage', slippage);
            } catch (e) {
              return 'Error when calculating slippage';
            }

            if (avaxBalance < maxAvaxToBeSold(this.usdToAVAX(asset.price) * value, slippage)) {
              return 'Requested asset value exceeds your available AVAX balance';
            }
          }
        }
      ];
    },
    investWarnings(slippage) {
      return [
        {
          validate: () => {
            if (slippage !== null && slippage > .03) {
              return `Be careful, current slippage is above ${Math.floor(slippage * 100)}%`;
            }
          }
        }
      ];
    },
    redeemValidators(balance) {
      return [
        {
          validate: (value) => {
            if (value > balance) {
              return 'Requested amount exceeds your asset balance';
            }
          }
        }
      ];
    },
    redeemWarnings(asset) {
      return [
        {
          validate: async (value) => {
            let slippage = await this.calculateSlippageForSell(asset.symbol, asset.price, asset.decimals, asset.address, value);
            this.updateAsset(asset.symbol, 'sellSlippage', slippage);
            if (slippage > .03) {
              return 'Current slippage above 3%';
            }
          }
        }
      ];
    },
    //TODO: add optional chaining
    buySlippageInfo(asset) {
      return (value) =>
        `Current slippage ${(asset.buySlippage * 100).toFixed(2)}%, maximum slippage ${(acceptableSlippage(asset.buySlippage) * 100).toFixed(2)}%`;
    },
    sellSlippageInfo(asset) {
      return (value) =>
        `Current slippage ${(asset.sellSlippage * 100).toFixed(2)}%, maximum slippage ${(acceptableSlippage(asset.sellSlippage) * 100).toFixed(2)}%`;
    },
    toggleChart(symbol) {
      this.updateAsset(symbol, 'showChart', !this.list[symbol].showChart);
      this.updateAsset(symbol, 'buyInput', false);
      this.updateAsset(symbol, 'sellInput', false);
    },
    showBuyInput(symbol) {
      this.updateAsset(symbol, 'buyInput', true);
      this.updateAsset(symbol, 'sellInput', false);
      this.updateAsset(symbol, 'showChart', false);
    },
    showSellInput(symbol) {
      this.updateAsset(symbol, 'sellInput', true);
      this.updateAsset(symbol, 'buyInput', false);
      this.updateAsset(symbol, 'showChart', false);
    },
    investValue(asset, value) {
      console.log('invest value');
      console.log(asset);
      this.updateAsset(asset.symbol, 'waiting', true);
      this.handleTransaction(
        this.invest,
        {
          asset: asset.symbol,
          decimals: asset.decimals,
          amount: value,
          avaxAmount: this.usdToAVAX(asset.price * value),
          slippage: asset.buySlippage
        })
        .then(() => {
          console.log('invest success');
          this.updateAsset(asset.symbol, 'waiting', false);
          this.updateAsset(asset.symbol, 'sellInput', false);
          this.updateAsset(asset.symbol, 'buyInput', false);
          this.updateAsset(asset.symbol, 'showChart', false);
        });
    },
    redeemValue(asset, value) {
      this.updateAsset(asset.symbol, 'waiting', true);
      this.handleTransaction(
        this.redeem,
        {
          asset: asset.symbol,
          decimals: asset.decimals,
          amount: value,
          avaxAmount: this.usdToAVAX(asset.price * value),
          slippage: asset.sellSlippage
        })
        .then(() => {
          this.updateAsset(asset.symbol, 'waiting', false);
          this.updateAsset(asset.symbol, 'sellInput', false);
          this.updateAsset(asset.symbol, 'buyInput', false);
          this.updateAsset(asset.symbol, 'showChart', false);
        });
    },
    updateAsset(symbol, key, value) {
      Vue.set(this.list[symbol], key, value);
    },
    chartPoints(points) {
      if (points == null || points.length === 0) {
        return [];
      }

      let maxValue = 0;
      let minValue = points[0].value;

      let dataPoints = points.map(
        item => {
          if (item.value > maxValue) maxValue = item.value;

          if (item.value < minValue) minValue = item.value;

          return {
            x: item.timestamp,
            y: item.value
          };
        }
      );

      return [dataPoints, minValue, maxValue];
    },
    async updateAssets(list) {
      this.list = list;

      if (list) {
        for (const symbol of Object.keys(list)) {
          redstone.getHistoricalPrice(symbol, {
            startDate: Date.now() - 3600 * 1000 * 24 * 7,
            interval: 3600 * 1000,
            endDate: Date.now(),
            provider: 'redstone-avalanche'
          }).then(
            (resp) => {

              const [prices, minPrice, maxPrice] = this.chartPoints(
                resp
              );

              this.updateAsset(symbol, 'prices', prices);
              this.updateAsset(symbol, 'minPrice', minPrice);
              this.updateAsset(symbol, 'maxPrice', maxPrice);
            }
          );
        }
      }
    },
    share(asset) {
      return asset.price * asset.balance;
    },
    async checkBuySlippage(asset, amount) {
      try {
        const slippage =
          await this.calculateSlippageForBuy(asset.symbol, asset.price, asset.decimals, asset.address, amount);
        this.updateAsset(asset.symbol, 'buySlippage', slippage);
      } catch (e) {
      }
    },
    async checkSellSlippage(asset, amount) {
      try {
        const slippage =
          await this.calculateSlippageForSell(asset.symbol, asset.price, asset.decimals, asset.address, amount);

        this.updateAsset(asset.symbol, 'sellSlippage', slippage);
      } catch (e) {
      }
    },

    formatTokenBalance(balance) {
      const balanceOrderOfMagnitudeExponent = String(balance).split('.')[0].length - 1;
      const precisionMultiplierExponent = 5 - balanceOrderOfMagnitudeExponent;
      const precisionMultiplier = Math.pow(10, precisionMultiplierExponent >= 0 ? precisionMultiplierExponent : 0);
      return balance !== null ? String(Math.round(balance * precisionMultiplier) / precisionMultiplier) : '';
    },
  },
  watch: {
    assets: {
      handler(newVal) {
        this.updateAssets(newVal);
      },
      immediate: true
    }
  }
};
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

  &:not(:first-child) {
    margin-top: 40px;
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

.profit-avax-logo {
  width: 22px;
  height: 22px;
  margin-top: -3px;
  margin-right: -10px;
  margin-left: 2px;
}

</style>
