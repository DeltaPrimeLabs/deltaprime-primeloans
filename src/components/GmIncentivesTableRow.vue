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
        {{collectedArb ? collectedArb.toFixed(2) : 0}}&nbsp;
        <InfoIcon
            v-if="['0x4c9c76507d661f6fbdb2e641c7fe061f1743f8fd', '0x38716cba180d5bd3a4e51c6303a861a1e8fbef52', '0x9232800211347ec4ebeff3143f5dd34c438f214c', '0x14c047a8ca6238e9ea14a9a740a6010423a0783c'].includes(smartLoanContract.address)"
            class="info__icon"
            :tooltip="{content: 'Your account received excessive ARB rewards during the last distribution. Your ARB amount can be temporarily negative.', classes: 'info-tooltip'}"
        ></InfoIcon>
      </div>
      <div class="table__cell table__cell--double-value points-received">
        <div class="points-received-value" v-if="receivedPoints != null">
          <span>{{ receivedPoints ? receivedPoints.toFixed(0) : 0 }}&nbsp;<b class="multiplier">{{ `(x${(multiplier * 3).toFixed(0)})` }}</b></span>
          <img src="src/assets/icons/icon_circle_star.svg" class="point-star-icon" />
        </div>
        <div v-else>
          <vue-loaders-ball-beat color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
        </div>
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
import GM_DISTRIBUTED from '../data/arbitrum/GM_EPOCH_7_corrected.json';
import DeltaIcon from "./DeltaIcon.vue";
import BarGaugeBeta from "./BarGaugeBeta.vue";
import { fetchGmTransactions } from '../utils/graph';
import { fromWei, formatUnits, fromBytes32 } from '../utils/calculate';
import { getData } from '../utils/blockchain';
import InfoIcon from "./InfoIcon.vue";

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'GmIncentivesTableRow',
  components: {
    InfoIcon,
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
      receivedPoints: null,
      multiplier: null
    };
  },

  computed: {
    ...mapState('fundsStore', [
        'apys',
        'smartLoanContract',
        'historicalSmartLoanContract',
        'assets',
        'gmxV2Balances',
        'gmxV2Assets',
    ]),
    ...mapState('stakeStore', ['farms']),
    ...mapState('poolStore', ['pools']),
    ...mapState('network', ['provider', 'historicalProvider', 'account']),
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
        }
      },
    },
    historicalSmartLoanContract: {
      async handler(historicalSmartLoanContract) {
        if (historicalSmartLoanContract) {
          this.calculatePoints();
        }
      }
    }
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
        this.historicalProvider // ethers provider, required.
      );

      return await dater.getDate(
        timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
        true // Block after, optional. Search for the nearest block before or after the given date. By default true.
      );
    },
    async calculatePoints() {

      const timestamps = [
        1701428400,// Dec 1 12pm CET
        1701687600,// Dec 4 12pm CET
        1702033200,// Dec 8 12pm CET
        1702292400,// Dec 11 12pm CET
        1702638000,// Dec 15 12pm CET
        1702897200,// Dec 18 12pm CET
        1703242800,// Dec 22 12pm CET
        1703502000,// Dec 25 12pm CET
        1703761200,// Dec 29 12pm CET
        1705316400,// Jan 15 12pm CET
        1706702400,// Jan 31 12pm CET
        1707562800,// Feb 10 12pm CET
        1707735600,// Feb 12 12pm CET
      ];

      const timestampToMultiplier = {
        1701428400: 0.33,
        1701687600: 0.33,
        1702033200: 0.33,
        1702292400: 0.33,
        1702638000: 0.33,
        1702897200: 0.33,
        1703242800: 0.33,
        1703502000: 0.33,
        1703761200: 0.33,
        1705316400: 1,
        1706702400: 2,
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
      const periods = [];

      for (let i = 0; i < timestamps.length - 1; i++) {
        if (timestamps[i] > now) break;

        const startOfPeriod = timestamps[i];
        const endOfPeriod = Math.min(timestamps[i + 1], now);
        const period = [startOfPeriod];

        for (const transaction of gmTransactions) {
          if (transaction.timestamp >= startOfPeriod && transaction.timestamp <= endOfPeriod) {
            period.push(parseFloat(transaction.timestamp));
          }
        }

        period.push(endOfPeriod);

        // if (period.length > 2) {
          periods.push(period);
        // }
      }

      let receivedPoints = 0;

      await Promise.all(
        periods.map(async (period) => {
          const startOfPeriod = period[0];
          const pricesOfStart = timestampToGmPrices[startOfPeriod] ? timestampToGmPrices[startOfPeriod] : [];

          let periodWeightedLeveragedGm = 0;
          await Promise.all(
            period.map(async (timestamp, idx) => {
              const timestamp0 = timestamp;

              if (period[idx + 1]) {
                try {
                  const timestamp1 = period[idx + 1];

                  const blockNumber = (await this.getBlockForTimestamp(timestamp0 * 1000)).block;
                  const wrappedContract = await wrapContract(this.smartLoanContract);

                  const loanStatus = await getData(wrappedContract.address, timestamp0);
                  const assetsBalances = await this.historicalSmartLoanContract.getAllAssetsBalances({ blockTag: blockNumber });

                  let loanTotalGm = 0;
                  Object.entries(config.GMX_V2_ASSETS_CONFIG).map(([symbol, token]) => {
                    const asset = assetsBalances.find(asset => fromBytes32(asset.name) == symbol);
                    const balance = formatUnits(asset.balance.toString(), token.decimals);

                    loanTotalGm += pricesOfStart[symbol].value * balance;
                  });

                  const leveragedGm = loanTotalGm - loanStatus.collateral;
                  const weightedLeveragedGm = leveragedGm * (timestamp1 - timestamp0) / 1000000;
                  periodWeightedLeveragedGm += weightedLeveragedGm;
                } catch (error) {
                  console.log(`points calculation failed at ${idx}, ${timestamp0}`);
                  console.log('Error: ', error);
                }
              }
            })
          );

          // const meanLeveragedGm = periodWeightedLeveragedGm / (7 * 24 * 60 * 60 );

          const pointsThisPeriod = periodWeightedLeveragedGm * timestampToMultiplier[startOfPeriod];

          receivedPoints += pointsThisPeriod;
        })
      )

      this.receivedPoints = receivedPoints;
      this.multiplier = timestampToMultiplier[Math.max(...(timestamps.filter(timestamp => timestamp <= now)))];
    },
    gridTemplateColumns() {
      const res = window.chain == 'avalanche' ? {gridTemplateColumns: '160px repeat(5, 1fr) 50px'} : {gridTemplateColumns: '160px 180px 160px repeat(3, 1fr) 130px 20px'};
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

      .points-received-value {
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }
    }
  }

  .stars-icon {
    width: 20px;
    margin-left: 2px;
    transform: translateY(-2px);
  }

  .point-star-icon {
    width: 25px;
    margin-left: 2px;
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
