<template>
  <div class="lp-table-row-component gm-incentives">
    <div class="table__row">
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
        {{ collectedBonus ? collectedBonus.toFixed(2) : 0 }}
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

const ethers = require('ethers');
import GM_DISTRIBUTED_ARBITRUM from '../data/arbitrum/GM_EPOCH_6.json';
import GM_DISTRIBUTED_AVALANCHE from '../data/avalanche/GM_EPOCH_0.json';
import DeltaIcon from "./DeltaIcon.vue";
import BarGaugeBeta from "./BarGaugeBeta.vue";

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
    collectedBonus: 0,
    gmTvlFromApi: 0
  },

  async mounted() {
    this.setGmTvlFromApi();
    this.$forceUpdate();
  },

  async created() {
    this.setGmTvlFromApi();
    this.$forceUpdate();
    this.setupMilestones();
  },

  data() {
    return {
      milestone: null
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
    ...mapState('serviceRegistry', []),
    ...mapGetters('fundsStore', [
      'getCollateral'
    ]),
    gmBoostApy() {
      if (window.arbitrumChain) {
        return (this.apys && this.assets['ARB'] && this.assets['ARB'].price) ? this.apys['GM_BOOST'].arbApy * this.assets['ARB'].price : 0;
      } else {
        return (this.apys && this.assets['AVAX'] && this.assets['AVAX'].price) ? this.apys['GM_BOOST'].avaxApy * this.assets['AVAX'].price : 0;
      }
    },
    totalLeveragedGm() {
      let apy;
      if (window.arbitrumChain) {
        apy = this.apys ? this.apys['GM_BOOST'].arbApy : 0;
      } else {
        apy = this.apys ? this.apys['GM_BOOST'].avaxApy : 0;
      }

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
          const collectedResponse = await (await fetch(`https://cavsise1n4.execute-api.us-east-1.amazonaws.com/gmx-incentives/${smartLoanContract.address}?network=${window.chain}`)).json();
          let collectedToken;
          let harvested;
          if (window.arbitrumChain) {
            harvested = GM_DISTRIBUTED_ARBITRUM[this.smartLoanContract.address.toLowerCase()] ? GM_DISTRIBUTED_ARBITRUM[this.smartLoanContract.address.toLowerCase()] : 0;
            collectedToken = collectedResponse.arbCollected;
          } else {
            harvested = GM_DISTRIBUTED_AVALANCHE[this.smartLoanContract.address.toLowerCase()] ? GM_DISTRIBUTED_AVALANCHE[this.smartLoanContract.address.toLowerCase()] : 0;
            collectedToken = collectedResponse.avaxCollected;
          }
          this.collectedBonus = collectedToken - harvested;
        }
      },
    },
  },

  methods: {
    ...mapActions('fundsStore', ['fund', 'withdraw', 'provideLiquidity', 'removeLiquidity']),
    async setGmTvlFromApi() {
      setTimeout(async () => {
        this.$forceUpdate();
        if (window.arbitrumChain) {
          this.gmTvlFromApi = (await (await fetch('https://cavsise1n4.execute-api.us-east-1.amazonaws.com/gm-boost-apy')).json()).arbTvl;
        } else {
          this.gmTvlFromApi = (await (await fetch('https://cavsise1n4.execute-api.us-east-1.amazonaws.com/gm-boost-apy')).json()).avaxTvl;
        }
      }, 100);
    },

    setupMilestones() {
      this.milestone = config.gmxV2IncentivesMilestone;
    },
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
    grid-template-columns: 160px repeat(5, 1fr) 50px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.tvl, &.leveraged, &.boost-apy, &.mission, &.arb-collected {
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
