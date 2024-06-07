<template>
  <div class="lp-tab">
    <div class="lp-tokens" v-if="Object.keys(gmxV2LpTokens).length">
      <div class="lp-table level" v-if="gmxV2LpTokens">
<!--        <InfoBubble >-->
<!--          Super cool LRT strats!-->
<!--        </InfoBubble>-->
        <TableHeader :config="gmxV2LpTableHeaderConfig"></TableHeader>
        <LrtTableRow v-for="(lpToken, index) in gmxV2LpTokens" v-bind:key="index" :index="index"
                         :lp-token="lpToken" :openInterestData="openInterestData[lpToken.symbol]"></LrtTableRow>
      </div>
    </div>
  </div>
</template>

<script>
import TableHeader from './TableHeader.vue';
import AssetFilter from './AssetFilter.vue';
import config from '../config';
import {mapState} from 'vuex';
import Paginator from "./Paginator.vue";
import LrtTableRow from "./LrtTableRow.vue";
import InfoBubble from "./InfoBubble.vue";

export default {
  name: 'LRTTab',
  components: {
    InfoBubble,
    LrtTableRow,
    Paginator, AssetFilter, TableHeader
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
      gmxV2LpTokens: config.LRT_ASSETS_CONFIG,
      gmxV2LpTableHeaderConfig: null,
      balancerLpTokens: config.BALANCER_LP_ASSETS_CONFIG,
      balancerLpTableHeaderConfig: null,
      levelLpTokens: config.LEVEL_LP_ASSETS_CONFIG,
      levelLpTableHeaderConfig: null,
      gmIncentivesTableHeaderConfig: null,
      selectedLpTokens: [] = [],
      assets: null,
      openInterestData: {},
    };
  },
  mounted() {
    this.watchAssetPricesUpdate();
    this.setupAssetFilterGroups();
    this.updateLpPriceData();
    this.setupGmxV2LpTableHeaderConfig();
    this.fetchOpenInterestData();
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
      return true;
    }
  },
  methods: {
    setLpFilter(filter) {
      this.selectedLpTokens = filter.asset;
      this.selectedDexes = filter.dex;
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

    async fetchOpenInterestData() {
      const data = await (await fetch('https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/gm-open-interests')).json();
      const mappedData = {};
      const tokens = Object.keys(data[0]).filter(key => key !== 'id');
      tokens.forEach(token => {
        mappedData[token] = []
      });

      data.forEach(dataPoint => {
        tokens.forEach(token => {
          mappedData[token].push({x: Number(dataPoint.id), y: dataPoint[token] * 100})
        });
      });
      this.openInterestData = mappedData;
    },


    setupGmxV2LpTableHeaderConfig() {
      this.gmxV2LpTableHeaderConfig = {
        gridTemplateColumns: 'repeat(6, 1fr) 60px 80px 22px',
        cells: [
          {
            label: 'LRT',
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
            label: 'Time to maturity',
            sortable: false,
            class: 'balance',
            id: 'tvl',
            tooltip: `The Total Value Locked (TVL) in the underlying pool.<br>
                      <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/pools#tvl' target='_blank'>More information</a>.`
          },
          {
            label: 'Boost',
            sortable: false,
            class: 'balance',
            id: 'tvl',
            tooltip: `The Total Value Locked (TVL) in the underlying pool.<br>
                      <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/pools#tvl' target='_blank'>More information</a>.`
          },
          {
            label: 'Max. boost',
            sortable: false,
            class: 'balance',
            id: 'tvl',
            tooltip: `The Total Value Locked (TVL) in the underlying pool.<br>
                      <a href='https://docs.deltaprime.io/prime-brokerage-account/portfolio/pools#tvl' target='_blank'>More information</a>.`
          },
          {
            label: 'Points',
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
      const token = window.arbitrumChain ? 'ARB' : 'AVAX';
      console.log(token);
      this.gmIncentivesTableHeaderConfig = {
        gridTemplateColumns: window.chain === 'avalanche' ? '160px repeat(5, 1fr) 50px' : '160px 180px 160px repeat(3, 1fr) 130px 20px',
        cells: [
          {
            label: 'Total eligible TVL',
            sortable: false,
            class: 'token',
            id: 'TOKEN',
            tooltip: 'The total dollar value of GM tokens that are eligible for incentives.'
          },
          {
            label: 'Mission completion',
            sortable: false,
            class: 'composition',
            id: 'COMPOSITION',
            tooltip: `How close we are to completing the protocol mission: $${config.gmxV2IncentivesMilestone / 1000000}M GM TVL.`
          },
          {
            label: 'Your eligible GM',
            sortable: false,
            class: 'composition',
            id: 'COMPOSITION',
            tooltip: `The dollar value you receive ${window.chain === 'arbitrum' ? 'ARB' : 'AVAX'} emissions over. This is calculated as: Total GM deposits - Collateral value.`
          },
          {
            label: '1x APR Boost',
            sortable: false,
            class: 'balance',
            id: 'BALANCE',
            tooltip: 'The APR you receive over your eligible TVL.'
          },
          {
            label: 'Max APR boost',
            sortable: false,
            class: 'balance',
            id: 'BALANCE',
            tooltip: 'The boost APR received if you would borrow enough to get health to 10%, and put your total value into GM pools.'
          },
          {
            label: `${token} collected`,
            sortable: false,
            class: 'trend-level',
            id: 'TREND',
            tooltip: `The total amount of ${token} you have collected this week. Collected ${token} will be distributed weekly. This number is not included in your collateral value, until the ${token} is distributed to all Prime Accounts. This number resets to 0 after the collected ${token} is added to your assets on Wednesday.`
          },
        ]
      };
      if (window.chain === 'arbitrum') {
        this.gmIncentivesTableHeaderConfig.cells.push({
          label: 'Tickets',
          sortable: false,
          class: 'trend-level',
          id: 'TREND',
          tooltip: `The raffle-tickets you accumulated. Mint more GM to boost your ticket-yield.`
        });
      }
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
    margin-top: 20px;
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
