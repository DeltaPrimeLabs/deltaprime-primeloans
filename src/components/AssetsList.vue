<template>
  <div class="lists">
    <div class="list">
      <div class="elements">
        <div class="title">Your investments</div>
        <div class="total">
          <span class="total-value-wrapper">
            <span class="total-value">
              Total value: <span class="value">$ {{ totalValue ? avaxToUSD(totalValue).toFixed(2) || usd : ''}}</span>
              <span class="vertical-line"></span>
              Your {{ profit >= 0 ? 'profit' : 'loss'}}: <span class="value" :class="{'red': profit < 0}">
              $ {{ (profit !== null && avaxPrice) ? avaxToUSD(profit).toFixed(2) || usd : ''}}</span>
            </span>
          </span>
        </div>
        <table id="investmentsTable">
          <thead>
            <tr>
              <th>Asset</th>
              <th class="right">Price</th>
              <th>Trend</th>
              <th class="right">Balance</th>
              <th class="right">Share</th>
              <th class="right">Value</th>
              <th>Buy/Sell</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="asset in investments"
              v-bind:key="asset.symbol">
              <td data-label="Asset">
                <div class="token-logo-wrapper">
                  <img :src="`https://cdn.redstone.finance/symbols/${asset.symbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`" class="token-logo"/>
                </div>
                <span class="token-name">{{ asset.name }}</span>
                </td>
              <td class="right" data-label="Price">
                <LoadedValue :check="() => asset.price != null" :value="asset.price | usd"></LoadedValue>
              </td>
              <td class="chart-icon" data-label="Chart">
                <SimpleChart
                  class="simple-chart"
                  :dataPoints="asset.prices"
                  :isStableCoin="asset.symbol === 'USDT'"
                  :lineWidth="1.5"/>
                <img @click.stop="toggleChart(asset.symbol)"
                     src="src/assets/icons/enlarge.svg"
                />
              </td>
              <td class="right" data-label="Balance">
                <LoadedValue
                    :check="() => asset.balance != null"
                    :value="formatTokenBalance(asset.balance)">
                </LoadedValue>
              </td>
              <td class="right" data-label="Share"><LoadedValue :value="asset.share | percent"></LoadedValue></td>
              <td class="right" data-label="Value"><LoadedValue :value="asset.value | usd"></LoadedValue>
              <td class="invest-buttons" @click.stop v-if="asset.symbol !== nativeToken">
                <img @click="showBuyInput(asset.symbol)" src="src/assets/icons/plus.svg" class="buy"/>
                <img src="src/assets/icons/slash-small.svg"/>
                <img @click="showSellInput(asset.symbol)" src="src/assets/icons/minus.svg" class="sell"/>
              </td>
              <td v-else class="center">-</td>
              <td class="asset-input" v-if="asset.buyInput" @click.stop>
                <SmallBlock
                  v-on:close="() => { asset.buyInput = false; }">
                  <CurrencyForm
                    label="Buy"
                    :symbol="asset.symbol"
                    :price="asset.price"
                    :hasSecondButton="true"
                    v-on:submitValue="(value) => investValue(asset, value)"
                    :waiting="asset.waiting"
                    :flexDirection="isMobile ? 'column' : 'row'"
                    :validators="investValidators(asset, list[nativeToken].balance)"
                    :warnings="investWarnings(asset.buySlippage)"
                    :info="buySlippageInfo(asset)"
                  />
                </SmallBlock>
              </td>
              <td class="asset-input" v-if="asset.sellInput" @click.stop>
                <SmallBlock
                  v-on:close="() => { asset.sellInput = false; }">
                  <CurrencyForm
                    label="Sell"
                    :symbol="asset.symbol"
                    :price="asset.price"
                    :hasSecondButton="true"
                    v-on:submitValue="(value) => redeemValue(asset, value)"
                    :max="asset.balance"
                    :waiting="asset.waiting"
                    :flexDirection="isMobile ? 'column' : 'row'"
                    :validators="redeemValidators(asset.balance)"
                    :warnings="redeemWarnings(asset)"
                    :info="sellSlippageInfo(asset)"
                  />
                </SmallBlock>
              </td>
              <td class="chart" v-if="asset.showChart && asset.prices" @click.stop>
                <SmallBlock
                  v-on:close="() => { asset.showChart = false; }">
                  <div class="big-chart">
                    <Chart
                        :dataPoints="asset.prices"
                        :minY="asset.minPrice" :maxY="asset.maxPrice" lineWidth="3"/>
                  </div>
                </SmallBlock>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="list options" v-if="investmentOptions && investmentOptions.length > 0">
      <div class="elements">
        <div class="title">Investment possibilities</div>
        <table id="optionsTable">
          <thead>
          <tr>
            <th>Asset</th>
            <th class="right">Price</th>
            <th>Trend</th>
            <th></th>
            <th></th>
            <th></th>
            <th>Buy</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="asset in investmentOptions"
              v-bind:key="asset.symbol">
            <td data-label="Asset">
              <div class="token-logo-wrapper">
                <img :src="`https://cdn.redstone.finance/symbols/${asset.symbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`" class="token-logo"/>
              </div>
              <span class="token-name">{{ asset.name }}</span>
            </td>
            <td class="right" data-label="Price">
              <LoadedValue :check="() => asset.price != null" :value="asset.price | usd"></LoadedValue>
            </td>
            <td class="chart-icon" data-label="Chart">
              <SimpleChart
                :dataPoints="asset.prices"
                :isStableCoin="asset.symbol === 'USDT'"
                :lineWidth="1.5"/>
              <img @click.stop="toggleChart(asset.symbol)" src="src/assets/icons/enlarge.svg"/>
            </td>
            <td v-if="!isMobile"></td>
            <td v-if="!isMobile"></td>
            <td v-if="!isMobile"></td>
            <td class="invest-buttons" @click.stop>
              <img v-if="asset.symbol !== nativeToken" @click="showBuyInput(asset.symbol)" src="src/assets/icons/plus.svg" class="buy"/>
            </td>
            <td class="asset-input" v-if="asset.buyInput" @click.stop>
              <SmallBlock
                v-on:close="() => { asset.buyInput = false;  }">
                <CurrencyForm
                  label="Buy"
                  :symbol="asset.symbol"
                  :price="asset.price"
                  :hasSecondButton="true"
                  v-on:submitValue="(value) => investValue(asset, value)"
                  v-on:changedValue="(value) => checkBuySlippage(asset, value)"
                  :waiting="asset.waiting"
                  :flexDirection="isMobile ? 'column' : 'row'"
                  :validators="investValidators(asset, list[nativeToken].balance)"
                  :warnings="investWarnings(asset.buySlippage)"
                  :info="buySlippageInfo(asset)"
                />
              </SmallBlock>
            </td>
            <td class="chart" v-if="asset.showChart && asset.prices" @click.stop>
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
            </td>
          </tr>
          </tbody>
        </table>
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
  import {mapState, mapActions, mapGetters} from "vuex";
  import redstone from 'redstone-api';
  import Vue from 'vue'
  import config from "@/config";
  import {maxAvaxToBeSold, acceptableSlippage} from "../utils/calculate";
  import {minAvaxToBeBought} from "../utils/calculate";


  export default {
    name: 'AssetsList',
    components: {
      Chart,
      Block,
      CurrencyForm,
      SimpleChart,
      SmallBlock,
      LoadedValue
    },
    props: {
      fields: [
        'Asset',
        'Price',
        'Balance',
        'Value',
        'Share',
        { key: 'actions', label: ''}
      ]
    },
    computed: {
      ...mapState('loan', ['totalValue', 'assets', 'loanHistory']),
      ...mapGetters('loan', ['getCurrentCollateral', 'getProfit']),
      investments() {
        if (this.list) {
          return Object.values(this.list).filter(
            asset => {
              return asset.balance > 0 || asset.symbol === this.nativeToken
            }
          )
        } else {
          return [];
        }
      },
      investmentOptions() {
        if (this.list) {
          return Object.values(this.list).filter(
            asset => {
              return (!asset.balance || asset.balance === 0) && asset.symbol !== this.nativeToken
            }
          )
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
        list: config.ASSETS_CONFIG
      }
    },
    methods: {
      ...mapActions('loan', ['invest', 'redeem']),
      investValidators(asset, avaxBalance) {
        return [
          {
            validate: async(value) => {
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
        ]
      },
      investWarnings(slippage) {
        return [
          {
            validate: () => {
              if (slippage !== null && slippage > .03) {
                return `Be careful, current slippage is above ${(slippage * 100).toFixed(0)}%`;
              }
            }
          }
        ]
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
        ]
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
        ]
      },
      //TODO: add optional chaining
      buySlippageInfo(asset) {
        return (value) =>
          `Cost will be
          <b>${this.usdToAVAX((maxAvaxToBeSold(asset.price * value, asset.buySlippage))).toPrecision(6)}</b>
          AVAX ($
          ${(maxAvaxToBeSold(asset.price * value, asset.buySlippage)).toPrecision(6)})
          with current slippage of ${(asset.buySlippage * 100).toFixed(2)}%
          (max. slippage ${(acceptableSlippage(asset.buySlippage) * 100).toFixed(2)}%)
          `
      },
      sellSlippageInfo(asset) {
        return (value) =>
          `You'll get
          <b>${(this.usdToAVAX(minAvaxToBeBought(asset.price * value, asset.sellSlippage))).toPrecision(6)}</b>
          AVAX ($
          ${(minAvaxToBeBought(asset.price * value, asset.sellSlippage)).toPrecision(6)})
          with current slippage of ${(asset.sellSlippage * 100).toFixed(2)}%
          (max. slippage ${(acceptableSlippage(asset.sellSlippage) * 100).toFixed(2)}%)
          `
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
        this.updateAsset(asset.symbol, 'waiting', true);
        this.handleTransaction(
          this.invest,
          { asset: asset.symbol,
            decimals: asset.decimals,
            amount: value,
            avaxAmount: this.usdToAVAX(asset.price * value),
            slippage: asset.buySlippage
          })
          .then(() => {
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
          { asset: asset.symbol,
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
            }
          }
        );

        return [dataPoints, minValue, maxValue ];
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
            )
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
        } catch (e) {}
      },
      async checkSellSlippage(asset, amount) {
        try {
          const slippage =
            await this.calculateSlippageForSell(asset.symbol, asset.price, asset.decimals, asset.address, amount);

          this.updateAsset(asset.symbol, 'sellSlippage', slippage);
        } catch (e) {}
      },
      formatTokenBalance(balance) {
        return balance !== null ? (balance > 1 ? balance.toFixed(2) : balance.toPrecision(2)) : '';
      }
    },
    watch: {
      assets: {
        handler(newVal) {
          this.updateAssets(newVal);
        },
        immediate: true
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.list {
  width: 100%;
}

.element {
  padding: 16px 0;
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
    height: 44px;
    padding: 12px 2px 2px;
  }

  .total-value {
    background: white;
    padding: 9px 20px;
    border-radius: 21px;
    font-size: 18px;

    .value {
      font-weight: 500;

      &.red {
        color: $red;
      }
    }

    .vertical-line {
      width: 3px;
      height: 17px;
      margin: 3px 18px 2px 19px;
      border-left: solid 2px #dadada;
    }
  }
}

.options {
  margin-top: 40px;
}

.chart-icon {
  text-align: right;
  margin-right: 15px;
  margin-left: 15px;

  img {
    height: 22px;
    margin-left: 5px;
    cursor: pointer;
  }
}

.invest-buttons {
  display: flex;
  justify-content: center;

  .buy, .sell {
    height: 20px;
    cursor: pointer;
    opacity: 0.7;
    transition: transform .4s ease-in-out;

    @media screen and (max-width: $md) {
      height: 44px;
    }

    &:hover {
      opacity: 1;
      transform: scale(1.05);
    }
  }
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

tr {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

td {
  display: flex;
  align-items: center;
}

thead tr {
  margin-bottom: 1rem;;
}

tbody tr {
  border-style: solid;
  border-width: 2px 0 0 0;
  border-image-source: linear-gradient(91deg, rgba(223, 224, 255, 0.43), rgba(255, 225, 194, 0.62), rgba(255, 211, 224, 0.79));
  border-image-slice: 1;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.chart, .asset-input {
   display: grid;
   grid-column: 1/-1;
   margin-top: 2rem;
   margin-bottom: 2rem;
   height: 230px;
}

.big-chart {
  width: 86%;
  align-self: center;
}

@media screen and (max-width: $md - 1) {
  .chart-icon, .invest-buttons {
    display: inline-block;
    border-bottom: none;
    text-align: start;
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
  }
}

.chart-loader {
  display: flex;
  justify-content: center;
}
</style>

<style lang="scss">
@import "~@/styles/variables";

#investmentsTable, #optionsTable {
  .small-block-wrapper {
    height: 230px;
  }

  .currency-form-wrapper {
    width: 100%;
    flex-wrap: wrap;
    margin-top: 50px;
    align-items: center;

    @media screen and (min-width: $md) {
      flex-wrap: nowrap;
      align-items: flex-start;
      align-self: center;
      width: min-content;
    }

    .input-wrapper {
      height: 60px;

      @media screen and (min-width: $md) {
        width: 90%;
      }
    }

    input {
      height: 30px;
      line-height: 30px;
      width: 60%;
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
      margin-left: 20px;
      font-size: 20px;

      &.waiting .ball-beat:not(.active) {
        margin-top: 4px;
        margin-bottom: 5px;
      }
    }

    .value-wrapper .label {
      text-align: start;
    }
  }
}
</style>
