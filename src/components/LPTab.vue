<template>
  <div class="lp-tab">
    <div class="lp-tokens">
      <div class="lp-table" v-if="traderJoeLpTokens">
        <TableHeader :config="traderJoeLpTableHeaderConfig"></TableHeader>
        <TraderJoeLpTableRow v-for="(lpToken, index) in traderJoeLpTokens" v-bind:key="index" :lp-token="lpToken"></TraderJoeLpTableRow>
      </div>
    </div>
    <div class="lp-tokens">
      <div class="lp-table" v-if="Object.keys(concentratedLpTokens).length">
        <TableHeader :config="concentratedLpTableHeaderConfig"></TableHeader>
        <ConcentratedLpTableRow v-for="(lpToken, index) in concentratedLpTokens" v-bind:key="index" :lp-token="lpToken">
          {{ lpToken }}
        </ConcentratedLpTableRow>
        <!--        <div class="paginator-container">-->
        <!--          <Paginator :total-elements="50" :page-size="6"></Paginator>-->
        <!--        </div>-->
      </div>
    </div>
    <div class="lp-tokens">
      <div class="filters" v-if="Object.keys(lpTokens).length && filteredLpTokens && assetFilterGroups">
        <AssetFilter ref="assetFilter" :asset-filter-groups="assetFilterGroups"
                     v-on:filterChange="setLpFilter"></AssetFilter>
      </div>
      <div class="lp-table" v-if="Object.keys(lpTokens).length && filteredLpTokens">
        <TableHeader :config="lpTableHeaderConfig"></TableHeader>
        <LpTableRow v-for="(lpToken, index) in filteredLpTokens" v-bind:key="index" :lp-token="lpToken"
                    showFarmed="false">{{ lpToken }}
        </LpTableRow>
        <!--        <div class="paginator-container">-->
        <!--          <Paginator :total-elements="50" :page-size="6"></Paginator>-->
        <!--        </div>-->
      </div>
    </div>
  </div>
</template>

<script>
import TableHeader from "./TableHeader.vue";
import ConcentratedLpTableRow from "./concentrated-lp/ConcentratedLpTableRow.vue";
import AssetFilter from "./AssetFilter.vue";
import LpTableRow from "./LpTableRow.vue";
import config from "../config";
import TraderJoeLpTableRow from "./TraderJoeLpTableRow.vue";
import {mapState} from "vuex";

export default {
  name: "LPTab",
  components: {TraderJoeLpTableRow, LpTableRow, AssetFilter, ConcentratedLpTableRow, TableHeader},
  data() {
    return {
      concentratedLpTokens: config.CONCENTRATED_LP_ASSETS_CONFIG,
      concentratedLpTableHeaderConfig: null,
      assetFilterGroups: null,
      lpTokens: config.LP_ASSETS_CONFIG,
      lpTableHeaderConfig: null,
      traderJoeLpTokens: config.TRADERJOEV2_LP_ASSETS_CONFIG,
      traderJoeLpTableHeaderConfig: null,
      selectedLpTokens: [] = [],
      assets: null
    }
  },
  mounted() {
    this.watchAssetPricesUpdate();
    this.setupAssetFilterGroups();
    this.setupConcentratedLpTableHeaderConfig();
    this.updateLpPriceData();
    this.setupTraderJoeLpTableHeaderConfig();
    this.setupLpTableHeaderConfig();
  },
  computed: {
    ...mapState('serviceRegistry', [
      'priceService'
    ]),
    filteredLpTokens() {
      return Object.values(this.lpTokens).filter(token =>
          (this.selectedLpTokens.includes(token.primary) || this.selectedLpTokens.includes(token.secondary))
          && this.selectedDexes.includes(token.dex)
      );
    },
  },
  methods: {
    setLpFilter(filter) {
      this.selectedLpTokens = filter.asset;
      this.selectedDexes = filter.dex;
    },
    setupConcentratedLpTableHeaderConfig() {
      this.concentratedLpTableHeaderConfig = {
        gridTemplateColumns: '160px 150px 260px 150px repeat(2, 1fr) 70px 60px 22px',
        cells: [
          {
            label: 'Concentrated LP',
            sortable: false,
            class: 'token',
            id: 'TOKEN',
            tooltip: `The concentrated LP-asset name. These names are simplified for a smoother UI.
                                       <a href='https://docs.deltaprime.io/integrations/tokens' target='_blank'>More information</a>.`
          },
          {
            label: 'Balance',
            sortable: false,
            class: 'balance',
            id: 'BALANCE',
            tooltip: `The number and value of unstaked assets in your Prime Account.`
          },
          {
            label: 'Composition',
            sortable: false,
            class: 'balance',
            id: 'COMPOSITION',
            tooltip: `Underlying assets`
          },
          {
            label: 'TVL',
            sortable: false,
            class: 'balance',
            id: 'tvl',
            tooltip: `The Total Value Locked (TVL) in the underlying pool. These numbers are regularly updated.<br>
                      <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/pools#tvl' target='_blank'>More information</a>.`
          },
          {
            label: 'Min. APR',
            sortable: false,
            class: 'apr',
            id: 'APR',
            tooltip: `The APR of the pool. This number includes 6.06% sAVAX price appreciation if the pool includes that asset.`
          },
          {
            label: 'Max. APR',
            sortable: false,
            class: 'apr',
            id: 'MAX-APR',
            tooltip: `The APR if you would borrow the lowest-interest asset from 100% to 10%, and put your total value into this pool.`
          },
          {
            label: '',
          },
          {
            label: 'Actions',
            class: 'actions',
            id: 'ACTIONS',
            tooltip: `Click
                      <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/exchange#actions' target='_blank'>here</a>
                      for more information on the different actions you can perform in your Prime Account.`
          },
        ]
      };
    },
    setupAssetFilterGroups() {
      this.assetFilterGroups = [
        {
          label: 'Filter by assets',
          options: config.ASSET_FILTER_TOKENS_OPTIONS,
          key: 'asset'
        },
        {
          label: 'Filter by DEX',
          options: config.ASSET_FILTER_DEXES_OPTIONS,
          key: 'dex',
        }
      ];

      this.selectedLpTokens = this.assetFilterGroups[0].options;
      this.selectedDexes = this.assetFilterGroups[1].options;
      setTimeout(() => {
        this.$refs.assetFilter.assetFilterGroups = this.assetFilterGroups;
        this.$refs.assetFilter.setupFilterValue();
      });
    },
    setupTraderJoeLpTableHeaderConfig() {
      this.traderJoeLpTableHeaderConfig = {
        gridTemplateColumns: '180px 100px 100px 195px 150px 120px 120px 35px 80px',
        cells: [
          {
            label: 'TraderJoe V2',
            sortable: false,
            class: 'token',
            id: 'TOKEN',
            tooltip: `The TraderJoe V2 LP-asset name. These names are simplified for a smoother UI.
                                       <a href='https://docs.deltaprime.io/integrations/tokens' target='_blank'>More information</a>.`
          },
          {
            label: 'Your Bins',
            sortable: false,
            class: 'balance',
            id: 'LIQUIDITY',
            tooltip: `Your liquidity distributed among bins.`
          },
          {
            label: 'Stats',
            sortable: false,
            class: 'balance',
            id: 'STATS',
            tooltip: `Statistics of your performance in the pool. Coming soon!<div class='tooltip-extra'>
            <img class="tooltip-extra__icon" src="src/assets/icons/rating.png"/>
            <span>This is a Prime feature</span>
            </div>`
          },
          {
            label: 'Composition',
            sortable: false,
            class: 'balance',
            id: 'COMPOSITION',
            tooltip: `Underlying assets`
          },
          {
            label: 'TVL',
            sortable: false,
            class: 'balance',
            id: 'tvl',
            tooltip: `The Total Value Locked (TVL) in the underlying pool. These numbers are regularly updated.<br>
                      <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/pools#tvl' target='_blank'>More information</a>.`
          },
          {
            label: 'Min. APR',
            sortable: false,
            class: 'apr',
            id: 'APR',
            tooltip: `Fees generated by pair divided by pair total liquidity. Remember that you need to be in the active bin to get generated fees.`
          },
          {
            label: 'Max. APR',
            sortable: false,
            class: 'apr',
            id: 'MAX-APR',
            tooltip: `The APR if you would borrow the lowest-interest asset from 100% to 10%, and put your total value into this pool.`
          },
          {
            label: '',
          },
          {
            label: 'Actions',
            class: 'actions',
            id: 'ACTIONS',
            tooltip: `Click
                      <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/exchange#actions' target='_blank'>here</a>
                      for more information on the different actions you can perform in your Prime Account.`
          },
        ]
      };
    },
    async updateLpPriceData() {
      //TODO: we have to make sure somehow that it's called in a right moment ->when assets have prices already
      console.log('updateLpPriceData')
      console.log(this.assets)
      console.log(this.lpTokens)
      if (this.assets) {
        Object.keys(this.lpTokens).forEach(
            key => {
              const lpToken = this.lpTokens[key];
              console.log('updateLpPriceData')
              console.log(this.assets)
              console.log(lpToken.primary)
              console.log(lpToken.secondary)
              console.log(this.assets[lpToken.primary].price)
              console.log(this.assets[lpToken.secondary].price)
              lpToken.firstPrice = this.assets[lpToken.primary].price;
              lpToken.secondPrice = this.assets[lpToken.secondary].price;
            }
        );
      }
    },
    setupLpTableHeaderConfig() {
      this.lpTableHeaderConfig = {
        gridTemplateColumns: 'repeat(4, 1fr) 12% 135px 60px 80px 22px',
        cells: [
          {
            label: 'LP Token',
            sortable: false,
            class: 'token',
            id: 'TOKEN',
            tooltip: `The LP-asset name. These names are simplified for a smoother UI.
                                       <a href='https://docs.deltaprime.io/integrations/tokens' target='_blank'>More information</a>.`
          },
          {
            label: 'Balance',
            sortable: false,
            class: 'balance',
            id: 'BALANCE',
            tooltip: `The number and value of unstaked assets in your Prime Account.`
          },
          {
            label: 'Farmed',
            sortable: false,
            class: 'farmed',
            id: 'FARMED',
            tooltip: `The number and value of staked assets in your Prime Account.`
          },
          {
            label: 'TVL',
            sortable: false,
            class: 'balance',
            id: 'tvl',
            tooltip: `The Total Value Locked (TVL) in the underlying pool.<br>
                      <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/pools#tvl' target='_blank'>More information</a>.`
          },
          {
            label: 'Min. APR',
            sortable: false,
            class: 'apr',
            id: 'APR',
            tooltip: `The APR of the pool. This number includes 6.06% sAVAX price appreciation if the pool includes that asset.`
          },
          {
            label: 'Max. APR',
            sortable: false,
            class: 'apr',
            id: 'MAX-APR',
            tooltip: `The APR if you would borrow the lowest-interest asset from 100% to 10%, and put your total value into this pool.`
          },
          {
            label: '',
          },
          {
            label: 'Actions',
            class: 'actions',
            id: 'ACTIONS',
            tooltip: `Click
                      <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/exchange#actions' target='_blank'>here</a>
                      for more information on the different actions you can perform in your Prime Account.`
          },
        ]
      };
    },
    watchAssetPricesUpdate() {
      this.priceService.observeRefreshPrices().subscribe((updateEvent) => {
        this.assets = config.ASSETS_CONFIG;
        this.updateLpPriceData();
      });
    }
  }
}
</script>

<style scoped>
.lp-tokens {
  display: flex;
  flex-direction: column;
  margin-top: 68px;

  .lp-table {

    .paginator-container {
      display: flex;
      flex-direction: row;
      justify-content: flex-end;
      margin-top: 12px;
    }
  }
}
</style>
