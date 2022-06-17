<template>
  <div class="fund-table-row-component" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="asset">
      <div class="table__cell asset">
        <img class="asset__icon" :src="getAssetIcon(asset.symbol)">
        <div class="asset__info">
          <div class="asset__name" v-on:click="logAsset(asset)">{{ asset.symbol }}</div>
          <div class="asset__loan" v-if="asset.symbol === 'AVAX'">Loan APY: {{ loanAPY | percent }}</div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value balance">
        <template v-if="asset.balance">
          <div class="double-value__pieces">
            <LoadedValue :check="() => asset.balance != null" :value="formatTokenBalance(asset.balance)"></LoadedValue>
          </div>
          <div class="double-value__usd">
            <span v-if="asset.balance">{{ asset.balance * asset.price | usd }}</span>
          </div>
        </template>
        <template v-if="!asset.balance">
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value loan">
        <template v-if="asset.symbol === 'AVAX'">
          <div class="double-value__pieces">{{ loanValue }}</div>
          <div class="double-value__usd">{{ loanValue * asset.price | usd }}</div>
        </template>
        <template v-if="asset.symbol !== 'AVAX'">
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell trend">
        <div class="trend__chart-change">
          <SmallChartBeta :data-points="asset.prices"
                          :is-stable-coin="asset.isStableCoin"
                          :line-width="2"
                          :width="60"
                          :height="25"
                          :positive-change="asset.todayPriceChange > 0">
          </SmallChartBeta>
          <ColoredValueBeta v-if="asset.todayPriceChange" :value="asset.todayPriceChange" :formatting="'percent'"
                            :percentage-rounding-precision="2"></ColoredValueBeta>
        </div>
        <IconButtonMenuBeta
          class="chart__icon-button"
          :config="{iconSrc: 'src/assets/icons/enlarge.svg', tooltip: 'Show chart'}"
          v-on:iconButtonClick="toggleChart()">
        </IconButtonMenuBeta>
      </div>

      <div class="table__cell price">
        {{ asset.price | usd }}
      </div>

      <div></div>

      <div class="table__cell actions">
        <IconButtonMenuBeta
          class="actions__icon-button"
          v-for="(actionConfig, index) of actionsConfig"
          v-bind:key="index"
          :config="actionConfig"
          v-on:menuOptionClick="openBorrowModal">
        </IconButtonMenuBeta>
      </div>
    </div>

    <div class="chart-container" v-if="showChart">
      <SmallBlock v-on:close="toggleChart()">
        <Chart :data-points="asset.prices"
               :line-width="3"
               :min-y="asset.minPrice"
               :max-y="asset.maxPrice"
               :positive-change="asset.todayPriceChange > 0">
        </Chart>
      </SmallBlock>
    </div>

  </div>
</template>

<script>
import SmallChartBeta from './SmallChartBeta';
import ColoredValueBeta from './ColoredValueBeta';
import PoolEventsList from './PoolHistoryList';
import IconButtonMenuBeta from './IconButtonMenuBeta';
import Chart from './Chart';
import SmallBlock from './SmallBlock';
import LoadedValue from './LoadedValue';
import config from '../config';
import redstone from 'redstone-api';
import Vue from 'vue';
import {mapState} from 'vuex';
import {aprToApy} from '../utils/calculate';
import BorrowModal from './BorrowModal';


export default {
  name: 'FundTableRowBeta',
  components: {LoadedValue, SmallBlock, Chart, IconButtonMenuBeta, PoolEventsList, ColoredValueBeta, SmallChartBeta},
  props: {
    asset: {}
  },
  mounted() {
    this.setupActionsConfiguration();
    this.setup24HourChange();
  },
  data() {
    return {
      actionsConfig: null,
      showChart: false,
      rowExpanded: false,
    };
  },
  computed: {
    ...mapState('pool', ['borrowingRate']),
    ...mapState('loan', ['debt']),
    mockedDataPoints() {
      return JSON.parse('[{"x":1652965140961,"y":6.9019801439999995},{"x":1652968747534,"y":6.94945},{"x":1652972343154,"y":7.0165764},{"x":1652975943477,"y":7.1855},{"x":1652979542178,"y":7.12636},{"x":1652983147624,"y":7.1680248},{"x":1652986764297,"y":7.144076},{"x":1652990342776,"y":7.07982242},{"x":1652993943745,"y":7.13114752},{"x":1652997544099,"y":7.09810595},{"x":1653001141018,"y":7.0677},{"x":1653004740647,"y":7.217060153589565},{"x":1653008341013,"y":7.178848221434007},{"x":1653011949158,"y":7.2649},{"x":1653015545636,"y":7.1676366300000005},{"x":1653019146102,"y":7.109550295586441},{"x":1653022746395,"y":7.053939},{"x":1653026346003,"y":7.112507342634552},{"x":1653029942462,"y":7.004},{"x":1653033543903,"y":7.0416568},{"x":1653037149458,"y":7.045112415},{"x":1653040749750,"y":7.1615},{"x":1653044343875,"y":7.21995972},{"x":1653047949774,"y":7.281669999999999},{"x":1653051540119,"y":7.1937},{"x":1653055140395,"y":7.24926284},{"x":1653058740275,"y":7.00074492},{"x":1653062346030,"y":6.852786384234284},{"x":1653065945177,"y":6.8112819},{"x":1653069545436,"y":6.8397824},{"x":1653073145826,"y":6.83019392},{"x":1653076746155,"y":6.971624},{"x":1653080346414,"y":6.88332001},{"x":1653083946781,"y":6.88050934},{"x":1653087547064,"y":6.8804232},{"x":1653091147364,"y":6.8581727599999995},{"x":1653094747717,"y":6.88213152},{"x":1653098347990,"y":6.8427788000000005},{"x":1653101948358,"y":6.908829444},{"x":1653105548622,"y":6.962265244},{"x":1653109148929,"y":6.93676588},{"x":1653112749254,"y":6.9231},{"x":1653116349516,"y":6.948455249999999},{"x":1653119949856,"y":7.0110408885},{"x":1653123540140,"y":6.98480801},{"x":1653127140409,"y":6.9585459400000005},{"x":1653130740674,"y":6.9754664250000005},{"x":1653134347852,"y":6.971110019999999},{"x":1653137948223,"y":6.96188352},{"x":1653141548441,"y":6.9746952},{"x":1653145148640,"y":7.02620625},{"x":1653148749658,"y":7.051145724000001},{"x":1653152343986,"y":7.038024502200001},{"x":1653155944236,"y":7.0431472894144616},{"x":1653159544609,"y":7.084},{"x":1653163144894,"y":7.045745598252962},{"x":1653166746642,"y":7.03269574541918},{"x":1653170346918,"y":6.9960823003384025},{"x":1653173945098,"y":7.04075},{"x":1653177545457,"y":7.049905709591522},{"x":1653181145746,"y":7.06734},{"x":1653184746043,"y":7.057916673309366},{"x":1653191948042,"y":7.025310300686334},{"x":1653195541503,"y":6.9312965871635805},{"x":1653199147388,"y":6.952866532899215},{"x":1653202743440,"y":7.00375923},{"x":1653206342666,"y":7.0404806},{"x":1653209944574,"y":7.095},{"x":1653213544318,"y":7.282},{"x":1653217144431,"y":7.2758},{"x":1653220744797,"y":7.25318572},{"x":1653224345019,"y":7.356},{"x":1653227942519,"y":7.278754999999999},{"x":1653231540758,"y":7.331},{"x":1653235141144,"y":7.2273168},{"x":1653238745010,"y":7.250779327999999},{"x":1653242342902,"y":7.249416859999999},{"x":1653245943155,"y":7.269694530000001},{"x":1653249545312,"y":7.22245},{"x":1653253144021,"y":7.220871900000001},{"x":1653256746283,"y":7.2011438028},{"x":1653260348520,"y":7.3142784},{"x":1653263948793,"y":7.319040241500001},{"x":1653267545325,"y":7.3723203},{"x":1653271145489,"y":7.263201680000001},{"x":1653274745755,"y":7.205526245},{"x":1653278346890,"y":7.263995489421783},{"x":1653281947151,"y":7.33123032},{"x":1653285547500,"y":7.38248928},{"x":1653289147777,"y":7.456},{"x":1653292748112,"y":7.509765123},{"x":1653296342420,"y":7.4595803300000005},{"x":1653299947861,"y":7.50212095},{"x":1653303548224,"y":7.5277097},{"x":1653307193971,"y":7.55641815},{"x":1653310742113,"y":7.504040970000001},{"x":1653314347555,"y":7.533214},{"x":1653317947953,"y":7.494474235},{"x":1653321540758,"y":7.564834299999999},{"x":1653328740524,"y":7.5180487975},{"x":1653332348510,"y":7.458368395},{"x":1653335947633,"y":7.194100000000001},{"x":1653339547927,"y":7.287603},{"x":1653343148223,"y":7.23782493},{"x":1653346749925,"y":7.09754535},{"x":1653350347998,"y":7.005387600000001},{"x":1653353949320,"y":7.01293005},{"x":1653357549169,"y":7.075914009},{"x":1653361149477,"y":7.071271650000001},{"x":1653364749761,"y":7.06456415},{"x":1653368340154,"y":7.07586705},{"x":1653371940422,"y":7.048288345},{"x":1653375547869,"y":7.055380535},{"x":1653379148235,"y":7.099132355},{"x":1653382745538,"y":6.92798205},{"x":1653386340920,"y":6.981505},{"x":1653389949319,"y":7.050216255},{"x":1653393548329,"y":6.9765},{"x":1653397144700,"y":6.9887542499999995},{"x":1653400747926,"y":6.8075925},{"x":1653404348279,"y":6.877265850000001},{"x":1653407942747,"y":7.0641604000000005},{"x":1653411543079,"y":7.0498430999999995},{"x":1653415146928,"y":7.033514135},{"x":1653418747256,"y":7.0205075436849995},{"x":1653422346575,"y":7.066467015},{"x":1653425946906,"y":7.141796055},{"x":1653429547186,"y":7.207800000000001},{"x":1653433147514,"y":7.213052405},{"x":1653436746601,"y":7.2289935750000005},{"x":1653440344757,"y":7.179643169999999},{"x":1653443944982,"y":7.190301},{"x":1653447593318,"y":7.35},{"x":1653451145435,"y":7.32763073},{"x":1653454741102,"y":7.25471103},{"x":1653458343921,"y":7.18768484},{"x":1653461946233,"y":7.1760385},{"x":1653465540634,"y":7.11977},{"x":1653469142557,"y":7.1528100299999995},{"x":1653472744577,"y":7.14876032},{"x":1653476346833,"y":7.0918116200000005},{"x":1653479944736,"y":6.98770234},{"x":1653483545023,"y":7.03995},{"x":1653487142966,"y":7.124148},{"x":1653490743098,"y":7.08491392},{"x":1653494345959,"y":7.064477},{"x":1653497945439,"y":7.02328808},{"x":1653501545771,"y":7.012115816},{"x":1653505146012,"y":7.0740680000000005},{"x":1653508745879,"y":6.99405028},{"x":1653512346172,"y":7.034872139999999},{"x":1653515945184,"y":7.0640517},{"x":1653519558684,"y":7.0493},{"x":1653523149478,"y":6.953785955},{"x":1653526743600,"y":7.0264500000000005},{"x":1653530343875,"y":6.979013575081892},{"x":1653533945476,"y":7.026824961417308},{"x":1653537545804,"y":7.001012495245279},{"x":1653541148973,"y":6.93245517},{"x":1653544749204,"y":6.7915019045898735},{"x":1653548346121,"y":6.767447989651972},{"x":1653551946489,"y":6.83332208405336},{"x":1653555546742,"y":6.503},{"x":1653559148226,"y":6.52901445},{"x":1653562740264,"y":6.52228545},{"x":1653566346730,"y":6.452894}]');
    },

    loanAPY() {
      return aprToApy(this.borrowingRate);
    },

    loanValue() {
      return this.formatTokenBalance(this.debt);
    }
  },
  methods: {
    setupActionsConfiguration() {
      this.actionsConfig = [
        {
          iconSrc: 'src/assets/icons/plus.svg',
          tooltip: 'Add / Borrow',
          menuOptions: [
            {
              key: 'ADD_FROM_WALLET',
              name: 'Add from wallet'
            },
            {
              key: 'BORROW',
              name: 'Borrow'
            }
          ]
        },
        {
          iconSrc: 'src/assets/icons/minus.svg',
          tooltip: 'Withdraw / Repay',
          menuOptions: [
            {
              key: 'WITHDRAW',
              name: 'Withdraw'
            },
            {
              key: 'REPAY',
              name: 'Repay'
            }
          ]
        },
        {
          iconSrc: 'src/assets/icons/swap.svg',
          tooltip: 'Swap',
          iconButtonActionKey: 'SWAP'
        },
      ];
    },

    toggleChart() {
      if (this.rowExpanded) {
        this.showChart = false;
        this.rowExpanded = false;
      } else {
        this.rowExpanded = true;
        setTimeout(() => {
          this.showChart = true;
        }, 200);
      }
    },

    formatTokenBalance(balance) {
      console.log(balance);
      const balanceOrderOfMagnitudeExponent = String(balance).split('.')[0].length - 1;
      const precisionMultiplierExponent = 5 - balanceOrderOfMagnitudeExponent;
      const precisionMultiplier = Math.pow(10, precisionMultiplierExponent >= 0 ? precisionMultiplierExponent : 0);
      return balance !== null ? String(Math.round(balance * precisionMultiplier) / precisionMultiplier) : '';
    },

    logAsset(asset) {
      console.log(asset);
    },

    getAssetIcon(assetSymbol) {
      assetSymbol = assetSymbol ? assetSymbol : 'avax';
      const asset = config.ASSETS_CONFIG[assetSymbol.toUpperCase()];
      return `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`;
    },

    setup24HourChange() {
      const date24HoursAgo = Date.now() - 1000 * 3600 * 24;
      redstone.getHistoricalPrice(this.asset.symbol, {
        date: date24HoursAgo,
      }).then(price => {
        console.log(price.value);
        const priceChange = this.asset.price - price.value;
        Vue.set(this.asset, 'todayPriceChange', priceChange / this.asset.price);
      });

    },

    openBorrowModal(key) {
      console.log(key);
      if (key === 'BORROW') {
        this.openModal(BorrowModal);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.fund-table-row-component {
  height: 60px;
  transition: all 200ms;

  &.expanded {
    height: 387px;
  }

  .table__row {
    display: grid;
    grid-template-columns: repeat(3, 1fr) 20% 1fr 76px 102px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: linear-gradient(to right, #dfe0ff 43%, #ffe1c2 62%, #ffd3e0 79%);
    border-image-slice: 1;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.asset {
        align-items: center;

        .asset__icon {
          width: 20px;
          height: 20px;
        }

        .asset__info {
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-left: 8px;
          font-weight: 500;
        }

        .asset__loan {
          font-size: $font-size-xxs;
          color: $medium-gray;
        }
      }

      &.balance {
        align-items: flex-end;
      }

      &.loan {
        align-items: flex-end;
      }

      &.trend {
        justify-content: center;
        align-items: center;
        margin-left: 49px;

        .trend__chart-change {
          display: flex;
          flex-direction: column;
          font-size: $font-size-xxs;
          align-items: center;
        }

        .chart__icon-button {
          margin-left: 7px;
        }
      }

      &.price {
        justify-content: flex-end;
        align-items: center;
        font-weight: 500;
      }

      &.actions {
        align-items: center;

        .actions__icon-button {
          &:not(:last-child) {
            margin-right: 12px;
          }
        }
      }

      &.table__cell--double-value {
        flex-direction: column;
        justify-content: center;

        .double-value__pieces {
          font-size: $font-size-xsm;
          font-weight: 600;
        }

        .double-value__usd {
          font-size: $font-size-xxs;
          color: $medium-gray;
          font-weight: 500;
        }

        &.loan {
          .double-value__pieces {
            font-weight: 500;
          }
        }
      }

      .no-value-dash {
        height: 1px;
        width: 15px;
        background-color: $medium-gray;
      }
    }
  }

  .chart-container {
    margin: 2rem 0;
  }
}

</style>