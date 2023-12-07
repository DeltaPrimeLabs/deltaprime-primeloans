<template>
  <div class="lp-table-row-component gm-incentives">
    <div class="table__row">
      <div class="table__cell table__cell--double-value tvl">
        {{ totalLeveragedGm | usd }}
      </div>
      <div class="table__cell table__cell--double-value mission">
        <bar-gauge-beta v-if="gmTvl" v-tooltip="{content: `Grant milestone completion: $${(gmTvl / 1000000).toFixed(1)}M / $3M`, classes: 'info-tooltip'}" :min="0" :max="3000000" :value="gmTvl" :width="108"></bar-gauge-beta>
      </div>
      <div class="table__cell table__cell--double-value leveraged">
        {{ leveragedGm | usd}}
      </div>
      <div class="table__cell table__cell--double-value boost-apy">
        <span><b>{{ gmBoostApy | percent }}</b><img v-tooltip="{content: `Including boost APR from the GM grant.`, classes: 'info-tooltip'}" src="src/assets/icons/stars.png" class="stars-icon"></span>
      </div>
      <div class="table__cell table__cell--double-value arb-collected">
        {{collectedArb ? collectedArb.toFixed(2) : 0}}
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
import AddFromWalletModal from './AddFromWalletModal';
import config from '../config';
import {mapActions, mapGetters, mapState} from 'vuex';
import ProvideLiquidityModal from './ProvideLiquidityModal';
import RemoveLiquidityModal from './RemoveLiquidityModal';
import WithdrawModal from './WithdrawModal';

const ethers = require('ethers');
import erc20ABI from '../../test/abis/ERC20.json';
import {calculateMaxApy, fromWei} from '../utils/calculate';
import addresses from '../../common/addresses/avalanche/token_addresses.json';
import {formatUnits, parseUnits} from 'ethers/lib/utils';
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
    collectedArb: 0,
    gmTvl: 0
  },

  async mounted() {
    this.setGmTvl();
  },

  data() {
    return {
    };
  },

  computed: {
    ...mapState('fundsStore', [
        'apys',
        'smartLoanContract',
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
      return this.apys ? this.apys['GM_BOOST'].arbApy : 0;
    },
    totalLeveragedGm() {
     let apy = this.apys ? this.apys['GM_BOOST'].arbApy : 0;

      return apy ? 10000 / (7 * 24 * 6) / apy * 6 * 24 * 365 : 0;
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
          this.collectedArb = collected.arbCollected;
        }
      },
    },
  },

  methods: {
    ...mapActions('fundsStore', ['fund', 'withdraw', 'provideLiquidity', 'removeLiquidity']),
    async setGmTvl() {
      this.gmTvl = (await (await fetch('https://cavsise1n4.execute-api.us-east-1.amazonaws.com/gm-boost-apy')).json()).tvl;
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
    grid-template-columns: 160px repeat(4, 1fr) 50px;
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
