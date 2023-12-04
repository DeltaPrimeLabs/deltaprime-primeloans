<template>
  <div class="lp-tab">
    <div class="lp-tokens" v-if="Object.keys(gmxV2LpTokens).length">
      <div class="lp-table" v-if="gmxV2LpTokens && hasGmIncentives">
        <div class="incentives-program-title">GM Incentives Program</div>
        <TableHeader :config="gmIncentivesTableHeaderConfig"></TableHeader>
        <GmIncentivesTableRow></GmIncentivesTableRow>
      </div>
    </div>
    <div class="lp-tokens" v-if="Object.keys(gmxV2LpTokens).length">
      <div class="lp-table level" v-if="gmxV2LpTokens">
        <TableHeader :config="gmxV2LpTableHeaderConfig"></TableHeader>
        <GmxV2LpTableRow v-for="(lpToken, index) in gmxV2LpTokens" v-bind:key="index" :index="index" :lp-token="lpToken"></GmxV2LpTableRow>
      </div>
    </div>
    <div class="lp-tokens">
      <div class="lp-table" v-if="traderJoeLpTokens">
        <TableHeader :config="traderJoeLpTableHeaderConfig"></TableHeader>
        <TraderJoeLpTableRow v-for="(lpToken, index) in traderJoeLpTokens" v-bind:key="index" :index="index"
                             :lp-token="lpToken" :lp-tokens="traderJoeLpTokens"></TraderJoeLpTableRow>
      </div>
    </div>
    <div class="lp-tokens" v-if="Object.keys(levelLpTokens).length">
      <div class="lp-table level" v-if="levelLpTokens">
        <TableHeader :config="levelLpTableHeaderConfig"></TableHeader>
        <div class="lp-table__warning">
          Junior and Mezzanine have been deprecated, and Senior is upgraded. Please reallocate funds from the Junior and
          Mezzanine tranche.
        </div>
        <LevelLpTableRow v-for="(lpToken, index) in levelLpTokens" v-bind:key="index" :index="index"
                         :lp-token="lpToken"></LevelLpTableRow>
      </div>
    </div>
    <div class="lp-tokens" v-if="Object.keys(concentratedLpTokens).length">
      <div class="lp-table">
        <TableHeader :config="concentratedLpTableHeaderConfig"></TableHeader>
        <ConcentratedLpTableRow v-for="(lpToken, index) in concentratedLpTokens" v-bind:key="index" :lp-token="lpToken">
          {{ lpToken }}
        </ConcentratedLpTableRow>
      </div>
    </div>
    <div class="lp-tokens" v-if="Object.keys(lpTokens).length && filteredLpTokens && assetFilterGroups">
      <div class="filters">
        <AssetFilter ref="assetFilter" :asset-filter-groups="assetFilterGroups"
                     v-on:filterChange="setLpFilter"></AssetFilter>
      </div>
      <div class="lp-table" v-if="Object.keys(lpTokens).length && filteredLpTokens">
        <TableHeader :config="lpTableHeaderConfig"></TableHeader>
        <LpTableRow v-for="(lpToken, index) in filteredLpTokens" v-bind:key="index" :lp-token="lpToken"
                    showFarmed="false">{{ lpToken }}
        </LpTableRow>
        <!--          <div class="paginator-container">-->
        <!--            <Paginator :total-elements="50" :page-size="6"></Paginator>-->
        <!--          </div>-->
      </div>
    </div>
  </div>
</template>

<script>
import TableHeader from './TableHeader.vue';
import ConcentratedLpTableRow from './concentrated-lp/ConcentratedLpTableRow.vue';
import AssetFilter from './AssetFilter.vue';
import LpTableRow from './LpTableRow.vue';
import config from '../config';
import TraderJoeLpTableRow from './TraderJoeLpTableRow.vue';
import {mapState} from 'vuex';
import Paginator from "./Paginator.vue";
import LevelLpTableRow from "./LevelLpTableRow.vue";
import GmxV2LpTableRow from "./GmxV2LpTableRow.vue";
import GmIncentivesTableRow from "./GmIncentivesTableRow.vue";

export default {
  name: 'LPTab',
  components: {
    GmIncentivesTableRow,
    GmxV2LpTableRow,
    LevelLpTableRow,
    Paginator, TraderJoeLpTableRow, LpTableRow, AssetFilter, ConcentratedLpTableRow, TableHeader
  },
  data() {
    return {
      concentratedLpTokens: config.CONCENTRATED_LP_ASSETS_CONFIG,
      concentratedLpTableHeaderConfig: null,
      assetFilterGroups: null,
      lpTokens: config.LP_ASSETS_CONFIG,
      lpTableHeaderConfig: null,
      traderJoeLpTokens: config.TRADERJOEV2_LP_ASSETS_CONFIG,
      traderJoeLpTableHeaderConfig: null,
      gmxV2LpTokens: config.GMX_V2_ASSETS_CONFIG,
      gmxV2LpTableHeaderConfig: null,
      levelLpTokens: config.LEVEL_LP_ASSETS_CONFIG,
      levelLpTableHeaderConfig: null,
      gmIncentivesTableHeaderConfig: null,
      selectedLpTokens: [] = [],
      assets: null
    };
  },
  mounted() {
    this.watchAssetPricesUpdate();
    this.setupAssetFilterGroups();
    this.setupConcentratedLpTableHeaderConfig();
    this.updateLpPriceData();
    this.setupTraderJoeLpTableHeaderConfig();
    this.setupLpTableHeaderConfig();
    this.setupLevelLpTableHeaderConfig();
    this.setupGmxV2LpTableHeaderConfig();
    this.setupGmIncentivesTableHeaderConfig();
  },
  computed: {
    ...mapState('serviceRegistry', [
      'priceService'
    ]),
    ...mapState('fundsStore', [
      'concentratedLpBalances',
    ]),
    filteredLpTokens() {
      return Object.values(this.lpTokens).filter(token =>
          (this.selectedLpTokens.includes(token.primary) || this.selectedLpTokens.includes(token.secondary))
          && this.selectedDexes.includes(token.dex)
      );
    },
    hasGmIncentives() {
      return config.chainId === 42161;
    }
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
        gridTemplateColumns: '180px 100px 100px 180px 140px 70px 110px 115px 30px 80px',
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
            label: 'Rewards',
            sortable: false,
            class: 'rewards',
            id: 'REWARDS',
            tooltip: `Trader Joe has received $1.44M in ARB to distribute to users from Nov-Jan 2023. The majority will be distributed over the 30 largest users of each incentivized pool. Click on a “Rewards” button to see how your Prime Account is performing.`
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
            label: 'APR (7D)',
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
      if (this.assets) {
        Object.keys(this.lpTokens).forEach(
            key => {
              const lpToken = this.lpTokens[key];
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
    setupLevelLpTableHeaderConfig() {
      this.levelLpTableHeaderConfig = {
        gridTemplateColumns: 'repeat(6, 1fr) 120px 120px 60px 80px 22px',
        cells: [
          {
            label: 'Level LLP',
            sortable: false,
            class: 'token',
            id: 'TOKEN',
            tooltip: `The LLP-asset name. These names are simplified for a smoother UI.
                                       <a href='https://docs.deltaprime.io/integrations/tokens' target='_blank'>More information</a>.`
          },
          {
            label: 'Balance',
            sortable: false,
            class: 'balance',
            id: 'BALANCE',
            tooltip: `The balance of this LLP in your Prime Account.`
          }, {
            label: 'Rewards',
            sortable: false,
            class: 'rewards',
            id: 'REWARDS',
            tooltip: `PreLVL incentives.`
          },
          {
            label: 'Trend (7D)',
            sortable: false,
            class: 'trend-level',
            id: 'TREND',
            tooltip: `7D price change of this LLP token. This does not include any earned preLVL incentives.`
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
            label: 'Capacity',
            sortable: false,
            class: 'capacity',
            id: 'capacity',
            tooltip: `The global maximum capacity of this LLP. When the capacity is at 100%, this asset can not be created or deposited.
            <a href='https://docs.deltaprime.io/protocol/security/token-exposure-protection' target='_blank'>More information</a>.
            `
          },
          {
            label: 'Min. APR',
            sortable: false,
            class: 'apr',
            id: 'APR',
            tooltip: `All fees, rewards and counterparty PnL collected, divided by TVL of this tranche. This does not take underlying asset price changes or IL into account.`
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
    setupGmxV2LpTableHeaderConfig() {
      this.gmxV2LpTableHeaderConfig = {
        gridTemplateColumns: 'repeat(2, 1fr) 240px 130px 100px 120px 100px 60px 80px 22px',
        cells: [
          {
            label: 'GM Token',
            sortable: false,
            class: 'token',
            id: 'TOKEN',
            tooltip: `The GM market name. These names are simplified for a smoother UI.`
          },
          {
            label: 'Balance',
            sortable: false,
            class: 'balance',
            id: 'BALANCE',
            tooltip: `The balance of this GM token in your Prime Account.`
          },
          {
            label: 'Composition',
            sortable: false,
            class: 'composition',
            id: 'COMPOSITION',
            tooltip: `Composition ot the GM token.`
          },
          {
            label: 'Trend (7D)',
            sortable: false,
            class: 'trend-level',
            id: 'TREND',
            tooltip: `7D price change of this GM token.`
          },
          {
            label: 'TVL',
            sortable: false,
            class: 'balance',
            id: 'tvl',
            tooltip: `The Total Value Locked (TVL) in the underlying pool.<br>
                      <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/pools#tvl' target='_blank'>More information</a>.`
          },
          // {
          //   label: 'Capacity',
          //   sortable: false,
          //   class: 'capacity',
          //   id: 'capacity',
          //   tooltip: `The global maximum capacity of this LLP. When the capacity is at 100%, this asset can not be created or deposited.
          //   <a href='https://docs.deltaprime.io/protocol/security/token-exposure-protection' target='_blank'>More information</a>.
          //   `
          // },
          {
            label: 'Min. APR',
            sortable: false,
            class: 'apr',
            id: 'APR',
            tooltip: `All fees, rewards and counterparty PnL collected, divided by TVL of this tranche. This does not take underlying asset price changes or IL into account.`
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
    setupGmIncentivesTableHeaderConfig() {
      this.gmIncentivesTableHeaderConfig = {
        gridTemplateColumns: '160px repeat(4, 1fr) 50px',
        cells: [
          {
            label: 'Total eligible TVL',
            sortable: false,
            class: 'token',
            id: 'TOKEN',
            tooltip: `The total dollar value of GM tokens that are eligible for incentives.`
          },
          {
            label: 'Mission completion',
            sortable: false,
            class: 'composition',
            id: 'COMPOSITION',
            tooltip: `How close we are to completing the protocol mission: $3M GM TVL. Deadline: December 25, 12pm CET. Failing the mission results in reduced incentives.`
          },
          {
            label: 'Your eligible GM',
            sortable: false,
            class: 'composition',
            id: 'COMPOSITION',
            tooltip: `The dollarvalue you receive ARB emissions over. This is calculated as: Total GM deposits - Collateral value.`
          },
          {
            label: 'APR Boost',
            sortable: false,
            class: 'balance',
            id: 'BALANCE',
            tooltip: `The APR you receive over your eligible TVL.`
          },
          {
            label: 'ARB collected',
            sortable: false,
            class: 'trend-level',
            id: 'TREND',
            tooltip: `The total amount of ARB you have collected this week. Collected ARB will be distributed weekly. This number is not included in your collateral value, until the ARB is distributed to all Prime Accounts.`
          },
        ]
      };
    },
    watchAssetPricesUpdate() {
      this.priceService.observeRefreshPrices().subscribe((updateEvent) => {
        this.assets = config.ASSETS_CONFIG;
        this.updateLpPriceData();
        if (this.concentratedLpBalances) {
          Object.entries(this.concentratedLpTokens).forEach(([k, v]) => {
            {
              if (v.inactive && (this.concentratedLpBalances && Number(this.concentratedLpBalances[k]) === 0)) delete this.concentratedLpTokens[k]
            }
          })
        }
      });
    }
  }
};
</script>

<style scoped lang="scss">
@import "~@/styles/variables";


.lp-tab {
  width: 100%;

  .lp-tokens {
    display: flex;
    flex-direction: column;
    margin-top: 68px;
    width: 100%;

    .lp-table {
      .incentives-program-title {
        font-size: $font-size-xxl;
        font-weight: bold;
        text-align: center;
        margin-bottom: 30px;
      }

      .paginator-container {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        margin-top: 12px;
      }

      .lp-table__warning {
        color: $orange;
        font-weight: 500;
        font-size: $font-size-xxs;
        padding-left: 10px;
      }
    }
  }
}
</style>
