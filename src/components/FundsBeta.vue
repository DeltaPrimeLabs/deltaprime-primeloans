<template>
  <div class="funds-beta-component">
<!--    <button v-on:click="wavaxSwap()">WavaxSwap</button>-->
    <div class="only-my-assets-checkbox">
      <Checkbox :label="'Show only my assets'"></Checkbox>
    </div>
    <div class="funds">
      <NameValueBadgeBeta v-if="calculateAvailableValue" :name="'Value of available funds'">{{ calculateAvailableValue | usd }}</NameValueBadgeBeta>
      <div class="funds-table" v-if="funds">
        <TableHeader :config="fundsTableHeaderConfig"></TableHeader>
        <div class="funds-table__body" v-if="assetBalances">
          <FundTableRowBeta v-for="(asset, index) in funds" v-bind:key="asset.symbol" :asset="asset" :balance="assetBalances[index]"></FundTableRowBeta>
        </div>
      </div>
      <div class="loader-container" v-if="!funds || !assetBalances">
        <VueLoadersBallBeat color="#A6A3FF" scale="1.5"></VueLoadersBallBeat>
      </div>
    </div>
    <div class="lp-tokens">
      <div class="filter-container">
        <div class="filter__label">Filter by:</div>
        <AssetFilter :asset-options="assetsFilterOptions"></AssetFilter>
      </div>
      <div class="lp-table" v-if="lpTokens">
        <TableHeader :config="lpTableHeaderConfig"></TableHeader>
        <LpTableRow v-for="(lpToken, index) in lpTokens" v-bind:key="index" :lp-token="lpToken"></LpTableRow>
        <div class="paginator-container">
          <Paginator :total-elements="50" :page-size="6"></Paginator>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import NameValueBadgeBeta from './NameValueBadgeBeta';
import config from '../config';
import FundTableRowBeta from './FundTableRowBeta';
import BorrowModal from './BorrowModal';
import {mapState, mapActions} from 'vuex';
import redstone from 'redstone-api';
import Vue from 'vue';
import Loader from './Loader';
import {fromWei, formatUnits} from '../utils/calculate';
import SwapModal from './SwapModal';
import {fetchCollateralFromPayments} from '../utils/graph';
import TableHeader from './TableHeader';
import AssetFilter from './AssetFilter';
import DoubleAssetIcon from './DoubleAssetIcon';
import LpTableRow from './LpTableRow';
import Paginator from './Paginator';
import Checkbox from './Checkbox';


export default {
  name: 'FundsBeta',
  components: {
    Checkbox,
    Paginator,
    LpTableRow, DoubleAssetIcon, AssetFilter, TableHeader, Loader, FundTableRowBeta, NameValueBadgeBeta},
  data() {
    return {
      funds: config.ASSETS_CONFIG,
      fundsTableHeaderConfig: null,
      lpTableHeaderConfig: null,
      assetsFilterOptions: null,
      lpTokens: null,
    }
  },
  computed: {
    ...mapState('fundsStore', ['assets', 'assetBalances', 'smartLoanContract', 'noSmartLoan']),
    calculateAvailableValue() {
      if (this.funds) {
        let availableValue = 0;
        Object.values(this.funds).forEach(asset => {
          availableValue += asset.balance * asset.price;
        });
        return availableValue;
      }
    }
  },
  watch: {
    assets: {
      handler(newFunds) {
        this.updateInternalFunds(newFunds);
      },
      immediate: true
    },
  },
  mounted() {
    this.setupFundsTableHeaderConfig();
    this.setupLpTableHeaderConfig();
    this.setupAssetsFilterOptions();
    this.mockLpTokens();
  },
  methods: {
    ...mapActions('fundsStore',
      [
        'fund',
        'borrow',
        'swapToWavax',
        'createLoan',
        'createAndFundLoan',
        'setupSmartLoanContract',
        'getAllAssetsBalances',
        'getDebts',
        'setAvailableAssetsValue',
        'updateFunds'
      ]),
    ...mapActions('poolStore', ['deposit']),
    fundClick() {
      this.fund();
    },

    borrowClick() {
      this.borrow();
    },

    wavaxSwap() {
      this.swapToWavax();
    },

    createLoanClick() {
      this.createLoan();
    },

    createAndFundLoanClick() {
      this.createAndFundLoan();
    },

    testLoanClick() {
      this.setupSmartLoanContract();
    },

    depositClick() {
      this.deposit();
    },

    testModal() {
      const swapModalInstance = this.openModal(SwapModal);
      swapModalInstance.sourceAsset = 'BTC';
      swapModalInstance.targetAsset = 'AVAX';
    },

    getAllAssetsBalancesClick() {
      this.getAllAssetsBalances();
    },

    debts() {
      this.getDebts();
    },

    async collateral() {
      const collateral = await fetchCollateralFromPayments(this.smartLoanContract.address);
      console.log(collateral);
    },

    update() {
      this.updateFunds();
    },


    updateFund(symbol, key, value) {
      Vue.set(this.funds[symbol], key, value);
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

    async updateInternalFunds(funds) {
      console.log(funds);
      this.funds = funds;

      if (funds) {
        Object.keys(funds).forEach((symbol, index) => {
          redstone.getHistoricalPrice(symbol, {
            startDate: Date.now() - 3600 * 1000 * 24 * 7,
            interval: 3600 * 1000,
            endDate: Date.now(),
            provider: 'redstone-avalanche'
          }).then(
            (response) => {

              const [prices, minPrice, maxPrice] = this.chartPoints(
                response
              );

              this.updateFund(symbol, 'prices', prices);
              this.updateFund(symbol, 'minPrice', minPrice);
              this.updateFund(symbol, 'maxPrice', maxPrice);
              if (this.assetBalances && this.assetBalances[index]) {
                const balance = formatUnits(this.assetBalances[index].balance, config.ASSETS_CONFIG[symbol].decimals);
                if (balance > 0) {
                  this.updateFund(symbol, 'balance', balance);
                } else {
                  this.updateFund(symbol, 'balance', null);
                }
              }
            }
          );
        })
      }
    },

    setupFundsTableHeaderConfig() {
      this.fundsTableHeaderConfig = {
        gridTemplateColumns: 'repeat(3, 1fr) 20% 1fr 76px 102px',
        cells: [
          {
            label: 'Asset',
            sortable: true,
            class: 'asset',
            id: 'ASSET'
          },
          {
            label: 'Balance',
            sortable: true,
            class: 'balance',
            id: 'BALANCE'
          },
          {
            label: 'Loan',
            sortable: true,
            class: 'loan',
            id: 'LOAN'
          },
          {
            label: 'Trend (24h)',
            sortable: true,
            class: 'trend',
            id: 'TREND'
          },
          {
            label: 'Price',
            sortable: true,
            class: 'price',
            id: 'PRICE'
          },
          {
            label: '',
          },
          {
            label: 'Actions',
            class: 'actions',
            id: 'ACTIONS'
          },
        ]
      }
    },

    setupLpTableHeaderConfig() {
      this.lpTableHeaderConfig = {
        gridTemplateColumns: '20% repeat(2, 1fr) 20% 1fr 76px 102px',
        cells: [
          {
            label: 'LP Token',
            sortable: true,
            class: 'token',
            id: 'TOKEN'
          },
          {
            label: 'Balance',
            sortable: true,
            class: 'balance',
            id: 'BALANCE'
          },
          {
            label: 'APR',
            sortable: true,
            class: 'apr',
            id: 'APR'
          },
          {
            label: 'Trend (24h)',
            sortable: true,
            class: 'trend',
            id: 'TREND'
          },
          {
            label: 'Price',
            sortable: true,
            class: 'price',
            id: 'PRICE'
          },
          {
            label: '',
          },
          {
            label: 'Actions',
            class: 'actions',
            id: 'ACTIONS'
          },
        ]
      }
    },

    setupAssetsFilterOptions() {
      this.assetsFilterOptions = ['AVAX', 'USDC', 'BTC', 'ETH', 'USDT', 'LINK', 'QI'];
    },

    mockLpTokens() {
      this.lpTokens = [
        {
          primary: 'AVAX',
          secondary: 'BTC',
          source: 'Pangolin',
          balance: 5.12974,
          price: 17.31,
          maxPrice: 18.393597249999996,
          minPrice: 16.87311252,
          apr: 0.02377421,
          priceGraphData: this.mockPrices(),
          todayPriceChange: 0.07643,

        },
        {
          primary: 'AVAX',
          secondary: 'ETH',
          source: 'Yield Yak',
          balance: 346.0201,
          price: 20,
          maxPrice: 18.393597249999996,
          minPrice: 16.87311252,
          apr: 0.402124,
          priceGraphData: this.mockPrices(),
          todayPriceChange: 0.003235,

        },
        {
          primary: 'BTC',
          secondary: 'ETH',
          source: 'Pangolin',
          balance: 0.00012325122515,
          price: 1.155151,
          maxPrice: 18.393597249999996,
          minPrice: 16.87311252,
          apr: 0.00125125,
          priceGraphData: this.mockPrices(),
          todayPriceChange: 0.01523,

        },
        {
          primary: 'BTC',
          secondary: 'LINK',
          source: 'Pangolin',
          balance: 213666231.12974,
          price: 0.000031,
          maxPrice: 18.393597249999996,
          minPrice: 16.87311252,
          apr: 0.51235125,
          priceGraphData: this.mockPrices(),
          todayPriceChange: 0.17643,

        },
      ]
    },

    mockPrices() {
      return JSON.parse('[{"x":1663952346822,"y":17.4},{"x":1663955947401,"y":17.331009754},{"x":1663959547975,"y":17.25},{"x":1663963148563,"y":17.471479778649538},{"x":1663966749161,"y":17.659269679440065},{"x":1663970349754,"y":17.84},{"x":1663973940346,"y":17.974495770000004},{"x":1663977540939,"y":17.969739615256763},{"x":1663981141532,"y":17.882},{"x":1663984742105,"y":17.973504149999997},{"x":1663988342692,"y":17.955385},{"x":1663991943281,"y":17.995396999999997},{"x":1663995543855,"y":18.13},{"x":1663999144439,"y":18.1527225},{"x":1664002745023,"y":17.982899099999997},{"x":1664006345626,"y":17.89048317},{"x":1664009946211,"y":17.96739276},{"x":1664013546783,"y":17.99},{"x":1664017147385,"y":17.95},{"x":1664020747967,"y":17.973594},{"x":1664024348547,"y":18.0316056},{"x":1664027949145,"y":17.981798},{"x":1664031549732,"y":17.893372224999997},{"x":1664035140321,"y":17.842676},{"x":1664038740894,"y":17.831},{"x":1664042341487,"y":17.823564},{"x":1664045942056,"y":17.9162685},{"x":1664049542639,"y":17.88},{"x":1664053143226,"y":17.9},{"x":1664056743811,"y":17.683},{"x":1664060344398,"y":17.649},{"x":1664063944992,"y":17.613522},{"x":1664067545588,"y":17.70007008},{"x":1664071146166,"y":17.758342499999998},{"x":1664074746752,"y":17.672416999999996},{"x":1664078347321,"y":17.80089},{"x":1664081947916,"y":17.864464999999996},{"x":1664085548487,"y":17.750887499999997},{"x":1664089149072,"y":17.71},{"x":1664092749658,"y":17.800338500000002},{"x":1664096340238,"y":17.741987054999996},{"x":1664099940804,"y":17.74814892},{"x":1664103541400,"y":17.712},{"x":1664107141986,"y":17.783978219999998},{"x":1664110742585,"y":17.6908845},{"x":1664114343169,"y":17.609},{"x":1664117943759,"y":17.551877549999997},{"x":1664121544327,"y":17.58},{"x":1664125144904,"y":17.538},{"x":1664128745482,"y":17.57833988907498},{"x":1664132346071,"y":17.568779999999997},{"x":1664135946632,"y":17.498744999999996},{"x":1664139547222,"y":17.414352499999996},{"x":1664143147827,"y":17.23},{"x":1664146748405,"y":17.347501735},{"x":1664150348960,"y":17.326062},{"x":1664153949562,"y":17.22677975},{"x":1664157540135,"y":17.35},{"x":1664161140731,"y":17.29},{"x":1664164741299,"y":17.25},{"x":1664168341879,"y":17.21014134},{"x":1664171942471,"y":17.14},{"x":1664175543060,"y":17.045},{"x":1664179143642,"y":17.216},{"x":1664182744226,"y":17.455235},{"x":1664186344801,"y":17.29},{"x":1664189945384,"y":17.369548},{"x":1664193545960,"y":17.212},{"x":1664197146536,"y":17.34},{"x":1664200747126,"y":17.40936454395764},{"x":1664204347721,"y":17.39},{"x":1664207948306,"y":17.390164362487848},{"x":1664211548900,"y":17.315163653621454},{"x":1664215149494,"y":17.383564300107604},{"x":1664218740063,"y":17.545427780220628},{"x":1664222340651,"y":17.49},{"x":1664225941239,"y":17.39},{"x":1664229541825,"y":17.350427970741848},{"x":1664233142396,"y":17.36016407894129},{"x":1664236742995,"y":17.570535999999997},{"x":1664240343570,"y":17.671967025935178},{"x":1664243944128,"y":17.860168804717247},{"x":1664247544713,"y":17.84016861568621},{"x":1664251145315,"y":17.9863943},{"x":1664254745897,"y":17.95548775},{"x":1664258346499,"y":18.08},{"x":1664261947082,"y":18.17333643486808},{"x":1664265547669,"y":18.160421444656734},{"x":1664269148249,"y":18.010036715354765},{"x":1664272748825,"y":18.032582091506335},{"x":1664276349409,"y":18.114527499999998},{"x":1664279949996,"y":18.02673214005},{"x":1664283540587,"y":18.088324869999997},{"x":1664287141182,"y":18.393597249999996},{"x":1664290741779,"y":18.200182},{"x":1664294342371,"y":17.861786},{"x":1664297942956,"y":17.2370575},{"x":1664301543541,"y":17.15},{"x":1664305144125,"y":17.217},{"x":1664308744710,"y":17.14057112057851},{"x":1664312345284,"y":17.183172297},{"x":1664315945884,"y":17.15},{"x":1664319546479,"y":17.314},{"x":1664323147061,"y":17.312},{"x":1664326747657,"y":17.30551319039474},{"x":1664330348255,"y":17.079430288617484},{"x":1664333948845,"y":16.957586374629038},{"x":1664337549427,"y":17.021985289945526},{"x":1664341140025,"y":17.033},{"x":1664344740615,"y":17.052},{"x":1664348341029,"y":16.87311252},{"x":1664351941636,"y":17.0291485},{"x":1664355542217,"y":16.9491525},{"x":1664359142827,"y":16.880459400000003},{"x":1664362743393,"y":17.013},{"x":1664366344001,"y":16.94},{"x":1664369944563,"y":17.044259999999998},{"x":1664373545160,"y":17.05},{"x":1664377145754,"y":17.2177445},{"x":1664380746331,"y":17.25},{"x":1664384346926,"y":17.229749899999998},{"x":1664387947515,"y":17.19929143920547},{"x":1664391548104,"y":17.3},{"x":1664395148691,"y":17.30000479566742},{"x":1664398749281,"y":17.369004814794646},{"x":1664402349855,"y":17.34},{"x":1664405940460,"y":17.263},{"x":1664409541056,"y":17.25386265},{"x":1664413141642,"y":17.198059859999997},{"x":1664416742231,"y":17.33},{"x":1664420342831,"y":17.202},{"x":1664423943431,"y":17.27},{"x":1664427544023,"y":17.284},{"x":1664431144622,"y":17.17},{"x":1664434745218,"y":17.205939660000002},{"x":1664438345752,"y":17.14},{"x":1664441946333,"y":17.111},{"x":1664445546918,"y":17.2285839},{"x":1664449147506,"y":17.23},{"x":1664452748061,"y":17.201826308405632},{"x":1664456348652,"y":17.09},{"x":1664459949236,"y":16.9844},{"x":1664463544085,"y":17.12911274},{"x":1664467144673,"y":17.13},{"x":1664470745275,"y":17.181718},{"x":1664474345859,"y":17.1},{"x":1664477946466,"y":17.114},{"x":1664481547058,"y":17.2548627},{"x":1664485147670,"y":17.27146353},{"x":1664488748239,"y":17.213},{"x":1664492348832,"y":17.1787177},{"x":1664495949415,"y":17.361736},{"x":1664499540006,"y":17.3},{"x":1664503140598,"y":17.331733},{"x":1664506741212,"y":17.421742000000002},{"x":1664510341800,"y":17.241723999999998},{"x":1664513942406,"y":17.33},{"x":1664517543000,"y":17.2937292},{"x":1664521143601,"y":17.321732},{"x":1664524744215,"y":17.531753000000002},{"x":1664528344807,"y":17.522628},{"x":1664531945413,"y":17.521752},{"x":1664535546016,"y":17.48},{"x":1664539146622,"y":17.3125965},{"x":1664542747232,"y":17.281728},{"x":1664546347807,"y":17.355},{"x":1664549948390,"y":17.57515734},{"x":1664553548999,"y":17.386083}]');
    }
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";


.funds-beta-component {
  width: 100%;

  .only-my-assets-checkbox {
    position: absolute;
    top: 24px;
    right: 30px;
  }

  .funds {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 35px;

    .funds-table {
      display: flex;
      flex-direction: column;
      width: 100%;
      margin-top: 65px;
    }

    .funds-table__body {
      display: flex;
      flex-direction: column;
    }

    .loader-container {
      margin-top: 40px;
    }
  }

  .lp-tokens {
    display: flex;
    flex-direction: column;
    margin-top: 68px;

    .filter-container {
      display: flex;
      flex-direction: row;
      align-items: center;
      margin-bottom: 10px;

      .filter__label {
        font-size: $font-size-xsm;
        color: $medium-gray;
        font-weight: 600;
        margin-right: 12px;
      }
    }

    .lp-table {

      .paginator-container {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        margin-top: 12px;
      }
    }
  }
}
</style>