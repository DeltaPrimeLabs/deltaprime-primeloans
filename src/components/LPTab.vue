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
    }
  },
  mounted() {
    this.setupAssetFilterGroups();
    this.setupConcentratedLpTableHeaderConfig();
    this.updateLpPriceData();
    this.setupTraderJoeLpTableHeaderConfig();
    this.setupLpTableHeaderConfig();
  },
  computed: {
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
        gridTemplateColumns: '140px 150px 120px 200px 140px repeat(2, 1fr) 35px 80px',
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
            label: 'Your Liquidity',
            sortable: false,
            class: 'balance',
            id: 'LIQUIDITY',
            tooltip: `The prices of your bins in liquidity pool.`
          },
          {
            label: 'Fees',
            sortable: false,
            class: 'balance',
            id: 'FEES-CLAIMABLE',
            tooltip: `Fees claimable from your liquidity pool.`
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
    async updateLpPriceData() {
      //TODO: we have to make sure somehow that it's called in a right moment ->when funds have prices already
      if (this.funds) {
        Object.keys(this.lpTokens).forEach(
            key => {
              const lpToken = this.lpTokens[key];
              lpToken.firstPrice = this.funds[lpToken.primary].price;
              lpToken.secondPrice = this.funds[lpToken.secondary].price;
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
  },
  watch: {
    funds: {
      handler() {
        this.updateLpPriceData();
      },
      immediate: true
    },
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
