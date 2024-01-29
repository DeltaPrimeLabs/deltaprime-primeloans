<template>
  <div class="lp-table-row-component gm-incentives">
    <div class="table__row" :style="gridTemplateColumns()">
      <div class="table__cell table__cell--double-value tvl">
        {{ totalLeveragedGm | usd }}
      </div>
      <div class="table__cell table__cell--double-value mission">
        <img v-if="gmTvlFromApi && gmTvlFromApi > 9000000" class="milestone-tick" width="16px" src="src/assets/icons/check.png" v-tooltip="{content: 'Milestone completed!', classes: 'info-tooltip long'}"/>
        <bar-gauge-beta v-if="gmTvlFromApi" v-tooltip="{content: `Grant milestone completion: $${(gmTvlFromApi / 1000000).toFixed(1)}M / $9M`, classes: 'info-tooltip'}" :min="0" :max="9000000" :value="gmTvlFromApi" :width="108"></bar-gauge-beta>
      </div>
      <div class="table__cell table__cell--double-value leveraged">
        {{ leveragedGm | usd}}
      </div>
      <div class="table__cell table__cell--double-value boost-apy">
        <span><b>{{ gmBoostApy | percent }}</b><img v-tooltip="{content: `Boost APR from the GM grant.`, classes: 'info-tooltip'}" src="src/assets/icons/stars.png" class="stars-icon"></span>
      </div>
      <div class="table__cell table__cell--double-value boost-apy">
        <span><b>{{ maxBoostApr | percent }}</b><img src="src/assets/icons/stars.png" class="stars-icon"></span>
      </div>
      <div class="table__cell table__cell--double-value arb-collected">
        {{collectedArb ? collectedArb.toFixed(2) : 0}}
      </div>
      <div class="table__cell table__cell--double-value points-received">
        {{ receivedPoints ? receivedPoints.toFixed(2) : 0 }}
      </div>
    </div>
  </div>
</template>

<script>
import DoubleAssetIcon from './DoubleAssetIcon';
import LoadedValue from './LoadedValue';
import SmallBlock from './SmallBlock';
import Chart from './Chart';
import IconButtonMenuBeta from './IconButtonMenuBeta';
import ColoredValueBeta from './ColoredValueBeta';
import SmallChartBeta from './SmallChartBeta';
import config from '../config';
import {mapActions, mapGetters, mapState} from 'vuex';
import redstone from "redstone-api";
const EthDater = require("ethereum-block-by-date");

const ethers = require('ethers');
import {wrapContract} from "../utils/blockchain";
import GM_DISTRIBUTED from '../data/arbitrum/GM_EPOCH_6.json';
import DeltaIcon from "./DeltaIcon.vue";
import BarGaugeBeta from "./BarGaugeBeta.vue";
import { fetchGmTransactions } from '../utils/graph';
import { fromWei, formatUnits, fromBytes32 } from '../utils/calculate';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'GmIncentivesTableRow',
  components: {
    BarGaugeBeta,
    DeltaIcon,
    DoubleAssetIcon,
    LoadedValue,
    SmallBlock,
    Chart,
    IconButtonMenuBeta,
    ColoredValueBeta,
    SmallChartBeta
  },
  props: {
    lpToken: null,
  },

  async mounted() {
    this.setGmTvlFromApi();
    this.$forceUpdate();
  },

  async created() {
    this.setGmTvlFromApi();
    this.$forceUpdate();
  },

  data() {
    return {
      points: 0,
      collectedArb: 0,
      gmTvlFromApi: 0,
      receivedPoints: 0,
    };
  },

  computed: {
    ...mapState('fundsStore', [
        'apys',
        'smartLoanContract',
        'assets',
        'gmxV2Balances',
        'gmxV2Assets',
    ]),
    ...mapState('stakeStore', ['farms']),
    ...mapState('poolStore', ['pools']),
    ...mapState('network', ['provider', 'account']),
    ...mapState('serviceRegistry', [
    ]),
    ...mapGetters('fundsStore', [
       'getCollateral'
    ]),
    gmBoostApy() {
      return (this.apys && this.assets['ARB'] && this.assets['ARB'].price) ? this.apys['GM_BOOST'].arbApy * this.assets['ARB'].price : 0;
    },
    totalLeveragedGm() {
     let apy = this.apys ? this.apys['GM_BOOST'].arbApy : 0;

      return apy ? 10000 / (7 * 24 * 6) / apy * 6 * 24 * 365 : 0;
    },
    maxBoostApr() {
      if (!this.gmBoostApy) return;
      return 4.5 * this.gmBoostApy;
    },
    leveragedGm() {
      if (!this.gmxV2Balances || !this.gmxV2Assets || !this.getCollateral) return 0;

      let gmWorth = 0;

      Object.keys(config.GMX_V2_ASSETS_CONFIG).forEach(
          gmSymbol => gmWorth += this.gmxV2Balances[gmSymbol] * this.gmxV2Assets[gmSymbol].price
      );

      return gmWorth - this.getCollateral > 0 ? gmWorth - this.getCollateral : 0;
    }
  },

  watch: {
    smartLoanContract: {
      async handler(smartLoanContract) {
        if (smartLoanContract) {
          const collected = await (await fetch(`https://cavsise1n4.execute-api.us-east-1.amazonaws.com/gmx-incentives/${smartLoanContract.address}?network=arbitrum`)).json();
          let harvestedArb = GM_DISTRIBUTED[this.smartLoanContract.address.toLowerCase()] ? GM_DISTRIBUTED[this.smartLoanContract.address.toLowerCase()] : 0;
          this.collectedArb = collected.arbCollected - harvestedArb;

          this.calculatePoints();
        }
      },
    },
  },

  methods: {
    ...mapActions('fundsStore', ['fund', 'withdraw', 'provideLiquidity', 'removeLiquidity']),
    async setGmTvlFromApi() {
      setTimeout(async () => {
        this.$forceUpdate();
        this.gmTvlFromApi = (await (await fetch('https://cavsise1n4.execute-api.us-east-1.amazonaws.com/gm-boost-apy')).json()).arbTvl;
      }, 100);
    },
    async getBlockForTimestamp(timestamp) {
      const dater = new EthDater(
        provider // ethers provider, required.
      );

      return await dater.getDate(
        timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
        true // Block after, optional. Search for the nearest block before or after the given date. By default true.
      );
    },
    async calculatePoints() {
      const timestamps = [
        1701428400,// Dec 1 12pm CET
        1705316400,// Jan 15 12pm CET
        1707130800,// Feb 5 12pm CET
        1707562800,// Feb 10 12pm CET
        1707735600,// Feb 12 12pm CET
      ];

      const timestampToMultiplier = {
        1701428400: 0.33,
        1705316400: 1,
        1707130800: 2,
        1707562800: 4,
        1707735600: 0
      };
      const timestampToGmPrices = {};
      const now = Math.floor(Date.now() / 1000);

      await Promise.all(
        timestamps.map(async timestamp => {
          if (timestamp <= now) {
            const prices = await redstone.getHistoricalPrice(Object.keys(config.GMX_V2_ASSETS_CONFIG), {date: timestamp * 1000});
            timestampToGmPrices[timestamp] = prices;
          }
        })
      );

      const gmTransactions = await fetchGmTransactions(this.smartLoanContract.address);
      const weeks = [];

      for (let i = 0; i < timestamps.length - 1; i++) {
        if (timestamps[i] > now) break;

        const startOfWeek = timestamps[i];
        const endOfWeek = Math.min(timestamps[i + 1], now);
        const week = [startOfWeek];

        for (const transaction of gmTransactions) {
          if (transaction.timestamp >= startOfWeek && transaction.timestamp <= endOfWeek) {
            week.push(parseFloat(transaction.timestamp));
          }
        }

        week.push(endOfWeek);

        // if (week.length > 2) {
          weeks.push(week);
        // }
      }

      let receivedPoints = 0;

      await Promise.all(
        weeks.map(async (week) => {
          const startOfWeek = week[0];
          const pricesOfStart = timestampToGmPrices[startOfWeek] ? timestampToGmPrices[startOfWeek] : [];

          let weekWeightedLeveragedGm = 0;
          await Promise.all(
            week.map(async (timestamp, idx) => {
              const timestamp0 = timestamp;

              if (week[idx + 1]) {
                const timestamp1 = week[idx + 1];

                const blockNumber = (await this.getBlockForTimestamp(timestamp0 * 1000)).block;
                const wrappedContract = await wrapContract(this.smartLoanContract);

                const [loanStatus, assetsBalances] = await Promise.all([
                  wrappedContract.getFullLoanStatus.call({ blockTag: blockNumber }),
                  wrappedContract.getAllAssetsBalances.call({ blockTag: blockNumber })
                ]);

                const collateral = fromWei(loanStatus[0]) - fromWei(loanStatus[1]);

                let loanTotalGm = 0;
                Object.entries(config.GMX_V2_ASSETS_CONFIG).map(([symbol, token]) => {
                  const asset = assetsBalances.find(asset => fromBytes32(asset.name) == symbol);
                  const balance = formatUnits(asset.balance.toString(), token.decimals);

                  loanTotalGm += pricesOfStart[symbol].value * balance;
                });

                const leveragedGm = loanTotalGm - collateral;
                const weightedLeveragedGm = leveragedGm * (timestamp1 - timestamp0);
                weekWeightedLeveragedGm += weightedLeveragedGm;
              }
            })
          );

          const meanLeveragedGm = weekWeightedLeveragedGm / (7 * 24 * 60 * 60 );

          const pointsThisWeek = meanLeveragedGm * timestampToMultiplier[startOfWeek];

          receivedPoints += pointsThisWeek;
        })
      )

      this.receivedPoints = receivedPoints;
    },
    gridTemplateColumns() {
      const res = window.chain == 'avalanche' ? {gridTemplateColumns: '160px repeat(5, 1fr) 50px'} : {gridTemplateColumns: '160px 180px 160px repeat(3, 1fr) 100px 50px'};
      return res;
    }
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.lp-table-row-component {
  height: 60px;
  transition: all 200ms;

  &.expanded {
    height: 387px;
  }

  .table__row {
    display: grid;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.tvl, &.leveraged, &.boost-apy, &.mission, &.arb-collected, &.points-received {
        align-items: center;
        justify-content: flex-end;
      }

      &.tvl, &.arb-collected, &.leveraged {
        padding-right: 24px;
      }

      &.mission {
        padding-right: 28px;
      }

      .no-value-dash {
        height: 1px;
        width: 15px;
        background-color: var(--asset-table-row__no-value-dash-color);
      }
    }
  }

  .stars-icon {
    width: 20px;
    margin-left: 2px;
    transform: translateY(-2px);
  }

  .milestone-tick {
    margin-right: 10px;
  }
}

.milestone-tick {
  margin-right: 10px;
}

</style>
<style>
.lp-table-row-component.gm-incentives {
  .table__row {
    .bar-gauge-beta-component .bar-gauge .bar {
      width: 108px;
    }
  }
}
</style>
