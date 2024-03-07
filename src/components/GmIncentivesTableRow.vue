<template>
  <div class="lp-table-row-component gm-incentives">
    <div class="table__row" :style="gridTemplateColumns()">
      <div class="table__cell table__cell--double-value tvl">
        {{ totalLeveragedGm | usd }}
      </div>
      <div class="table__cell table__cell--double-value mission">
        <img v-if="gmTvlFromApi && gmTvlFromApi > milestone" class="milestone-tick" width="16px"
             src="src/assets/icons/check.png"
             v-tooltip="{content: 'Milestone completed!', classes: 'info-tooltip long'}"/>
        <bar-gauge-beta v-if="gmTvlFromApi"
                        v-tooltip="{content: `Grant milestone completion: $${(gmTvlFromApi / 1000000).toFixed(1)}M / $${milestone / 1000000}M`, classes: 'info-tooltip'}"
                        :min="0" :max="milestone" :value="gmTvlFromApi" :width="108"></bar-gauge-beta>
      </div>
      <div class="table__cell table__cell--double-value leveraged">
        {{ leveragedGm | usd }}
      </div>
      <div class="table__cell table__cell--double-value boost-apy">
        <span><b>{{ gmBoostApy | percent }}</b><img
          v-tooltip="{content: `Boost APR from the GM grant.`, classes: 'info-tooltip'}"
          src="src/assets/icons/stars.png" class="stars-icon"></span>
      </div>
      <div class="table__cell table__cell--double-value boost-apy">
        <span><b>{{ maxBoostApr | percent }}</b><img src="src/assets/icons/stars.png" class="stars-icon"></span>
      </div>
      <div class="table__cell table__cell--double-value arb-collected">
        <span>{{ collectedBonus ? collectedBonus.toFixed(3) : 0  }}</span>
        <InfoIcon
            v-if="['0x4c9c76507d661f6fbdb2e641c7fe061f1743f8fd', '0x38716cba180d5bd3a4e51c6303a861a1e8fbef52', '0x9232800211347ec4ebeff3143f5dd34c438f214c', '0x14c047a8ca6238e9ea14a9a740a6010423a0783c', '0x14ec143849f5a56908c15e2e8963058fba54fcc0', '0x4ded392b98460b03f72C6E5800Cc742D62bcae5f', '0x845dE1f6A032Ac8E866B91596056a7fae7327068', '0x35aC398F2FfF9c92dCaD8F005837701B43357B55', '0x135B3256d60B3178d1b40459114b9A2724db10A3', '0x8333F64C0417CBA6aEdDFcf9e8B534c1bCBD5881', '0xC60DbfAb7f78A040E4B8567DBdB5af28332ABa94', '0xe0ad10dd0538D309b7F88B53495B7897c4D9b42d', '0x77074C947AcF2b24c6e9a830d0D4C05353BA6AD7', '0x01854f9E2c3DFfb477109E58c6bB71577273d323', '0xE15B857F9c9A57940295a0F3629ccC5C5ABEf0ED', '0x6b2b7f4365477F4c3a63aaE4a1817FEC1639477A', '0x5850A0398083d2CDe77b6109b00A15e249470e70', '0x6C09786F8aA6b6f07AA710514Ebbc9Bb8afBfdb3', '0xd7eD053b7A59fD4872d2E88c87CE8aB96aE72a77', '0x94Bad3B7414d5A43f9Db62e0e86d072159d3E6F9', '0x577dC0814B84D991F587b5250e60F9970b5e3F95', '0xc1916c4ff57830e97D9c3b93daFd83393F47e868', '0xAEc0193a32d05Af89dDE6B06a4A719062f7C6961', '0x043A4E5a917C228C28986c6D60E702AcC8A6E966', '0xF8D5605fe3e0Bdf38CC18e89a927Fa801Ba085f8', '0xE225a652133c218Aca2668C4423fBa2d138bbDcF', '0x952e073387Aaf62d927Fb2138Eb020a6bC2654F6', '0x434dFD5325df9e482D7864b8630a5e3433849dFC', '0x7EFC9C745eEd73A01E482076A81893b5Db933566', '0xD33F4Da927F1e888240466b82f6104e8e39068F2', '0x09ddbc9621032E648a1FA7436CA16cFD4aEA6bCe', '0xf15ceF9442678303b22334a8F6A4FEbCf9d268EE', '0xE785fF97dd4a295f6b859cCdd1893606984F55a8', '0xb3ee150b51A97E2417391Fb9B5b30674FD001990', '0x9a6769979438CcC148F5A4B1657cAe5D50D99924', '0x55474f2077bB900f09d87A3D82ad1Ca2F3086295', '0xE2ce857A3c6a4A59CF743216a45FDB6504BDF57b', '0x09beaAD631Bdb8688d5837f15bE3F6786E6171a5', '0x75B2f984429ab7D5B7937B9D0efcbED438e5e747', '0xb03593b28f92ae9f1232e3dc99daBD8cEC9dE559', '0x6822c50703a3b579412EE626cf8ed1d428dD368f', '0x0014F763814fEbb3226b4811e3a06e64C1d2642E', '0xaC21aF2C51909ad51c5b730cdf6f049C736D47b8', '0x5FF4b01D193684E1958d11f1435354a2596aD6a2', '0xd9668d7c6Dba56E806B28BfCCd96Ff178D2D4D02', '0x58Adc837837dc780A7641154417949aA2b0BC84e', '0xe81C6D8027Fc945808734BD6111bd7a4344FDC60', '0xBf6853a3b0016b121BEb7E6Dbe8Db728Fe79334f', '0x939d8Dba3143960f973e3198796BBe38C9AE9Ee5', '0x1cCB539b572bb8B478FD56A269cD32c8843148B0'].includes(smartLoanContract.address)"
            class="info__icon"
            :tooltip="{content: 'Your account received excessive ARB rewards during the last distribution. Your ARB amount can be temporarily negative.', classes: 'info-tooltip'}"
        ></InfoIcon>
      </div>
      <div v-if="showPoints" class="table__cell table__cell--double-value points-received">
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
import GM_DISTRIBUTED_ARBITRUM from '../data/arbitrum/GM_EPOCH_9.json';
import GM_DISTRIBUTED_AVALANCHE from '../data/avalanche/GM_EPOCH_4.json';
import {wrapContract} from "../utils/blockchain";
import DeltaIcon from "./DeltaIcon.vue";
import BarGaugeBeta from "./BarGaugeBeta.vue";
import { fetchGmTransactions } from '../utils/graph';
import { fromWei, formatUnits, fromBytes32 } from '../utils/calculate';
import { getData } from '../utils/blockchain';
import InfoIcon from "./InfoIcon.vue";
import Loader from "./Loader.vue";

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'GmIncentivesTableRow',
  components: {
    Loader,
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
    collectedBonus: 0,
    gmTvlFromApi: 0
  },

  data() {
    return {
      points: 0,
      collectedArb: 0,
      gmTvlFromApi: 0,
      receivedPoints: null,
      multiplier: null,
      milestone: null,
      showPoints: null,
      isAvalanche: false
    };
  },

  async mounted() {
    this.setGmTvlFromApi();
    this.$forceUpdate();
  },

  async created() {
    this.setGmTvlFromApi();
    this.$forceUpdate();
    this.setupMilestones();
    this.showPoints = window.chain === 'arbitrum';
    this.isAvalanche = window.chain === 'avalanche';
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
      if (window.arbitrumChain) {
        return 0;
      } else {
        return (this.apys && this.assets['AVAX'] && this.assets['AVAX'].price) ? this.apys['GM_BOOST'].avaxApy * this.assets['AVAX'].price : 0;
      }
    },
    totalLeveragedGm() {
      let apy, weeklyAmount;
      if (window.arbitrumChain) {
        apy = this.apys ? this.apys['GM_BOOST'].arbApy : 0;
        weeklyAmount = 0;
      } else {
        apy = this.apys ? this.apys['GM_BOOST'].avaxApy : 0;
        weeklyAmount = 1500;
      }

      return apy ? weeklyAmount / 7 * 365 / apy  : 0;
    },
    maxBoostApr() {
      if (!this.gmBoostApy) return 0;
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
          let collectedResponse;
          let collectedToken;
          let harvested;
          if (window.arbitrumChain) {
            collectedResponse = await (await fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/gmx-incentives/${smartLoanContract.address}?network=${window.chain}`)).json();
            harvested = GM_DISTRIBUTED_ARBITRUM[this.smartLoanContract.address.toLowerCase()] ? GM_DISTRIBUTED_ARBITRUM[this.smartLoanContract.address.toLowerCase()] : 0;
            collectedToken = collectedResponse.arbCollected;
          } else {
            collectedResponse = await (await fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/gmx-incentives-remake/${smartLoanContract.address}`)).json();
            harvested = GM_DISTRIBUTED_AVALANCHE[this.smartLoanContract.address] ? GM_DISTRIBUTED_AVALANCHE[this.smartLoanContract.address] : 0;
            collectedToken = collectedResponse.total;
          }

          this.collectedBonus = collectedToken - harvested;
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
        if (window.arbitrumChain) {
          this.gmTvlFromApi = (await (await fetch('https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/gm-boost-apy')).json()).arbTvl;
        } else {
          this.gmTvlFromApi = (await (await fetch('https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/gm-boost-apy')).json()).avaxTvl;
        }
      }, 1000);
    },

    setupMilestones() {
      this.milestone = config.gmxV2IncentivesMilestone;
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
      if (window.chain === 'avalanche') {
        return;
      }

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
      const template = window.chain === 'avalanche' ? {gridTemplateColumns: '160px repeat(5, 1fr) 50px'} : {gridTemplateColumns: '160px 180px 160px repeat(3, 1fr) 130px 20px'};
      return template;
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
