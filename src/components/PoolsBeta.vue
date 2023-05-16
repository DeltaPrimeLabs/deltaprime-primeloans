<template>
  <div class="pools-beta-component">
    <div class="container">
      <div class="main-content">
        <Block :bordered="true">
          <div class="title">Deposit</div>
          <NameValueBadgeBeta :name="'Your deposits'">{{ totalDeposit | usd }}</NameValueBadgeBeta>
          <div class="pools">
            <div class="pools-table">
              <TableHeader :config="poolsTableHeaderConfig"></TableHeader>
              <div class="pools-table__body">
                <PoolsTableRowBeta v-for="pool in poolsList" v-bind:key="pool.asset.symbol"
                                   :pool="pool"></PoolsTableRowBeta>
              </div>
            </div>
          </div>
        </Block>
      </div>
    </div>
  </div>
</template>

<script>

import config from '../config';
import Block from './Block';
import NameValueBadgeBeta from './NameValueBadgeBeta';
import PoolsTableRowBeta from './PoolsTableRowBeta';
import TableHeader from './TableHeader';
import {mapActions, mapState} from 'vuex';
import {combineLatest} from 'rxjs';

export default {
  name: 'PoolsBeta',
  components: {
    PoolsTableRowBeta,
    Block,
    NameValueBadgeBeta,
    TableHeader
  },
  async mounted() {
    this.setupPoolsTableHeaderConfig();
    this.initPools();
    this.watchPools();
    this.initStoresWhenProviderAndAccountCreated();
  },

  data() {
    return {
      totalTVL: 0,
      totalDeposit: 0,
      poolsList: null,
      poolsTableHeaderConfig: null,
    };
  },
  computed: {
    ...mapState('serviceRegistry', ['providerService', 'accountService', 'poolService']),
  },

  methods: {
    ...mapActions('poolStore', ['poolStoreSetup']),

    initStoresWhenProviderAndAccountCreated() {
      combineLatest([this.providerService.observeProviderCreated(), this.accountService.observeAccountLoaded()])
        .subscribe(async ([provider, account]) => {
          await this.poolStoreSetup();
        });
    },

    setupTotalTVL() {
      let totalTVL = 0;
      this.poolsList.forEach(pool => {
        totalTVL += pool.tvl * pool.assetPrice;
      });
      this.totalTVL = totalTVL;
    },

    setupTotalDeposit() {
      let totalDeposit = 0;
      this.poolsList.forEach(pool => {
        totalDeposit += pool.deposit * pool.assetPrice;
      });
      this.totalDeposit = totalDeposit;
      this.$forceUpdate();
    },

    initPools() {
      const pools = [];
      Object.entries(config.POOLS_CONFIG).forEach(([symbol, pool]) => {
        pools.push({
          asset: {
            symbol: symbol
          }
        });
      });
      this.poolsList = pools;
    },

    watchPools() {
      this.poolService.observePools().subscribe(pools => {
        this.poolsList = pools;
        this.setupTotalTVL();
        this.setupTotalDeposit();
        this.$forceUpdate();
      });
    },

    setupPoolsTableHeaderConfig() {
      this.poolsTableHeaderConfig = {
        gridTemplateColumns: 'repeat(3, 1fr) 20% 1fr 120px 76px 22px',
        cells: [
          {
            label: 'Asset',
            sortable: false,
            class: 'asset',
            id: 'ASSET',
            tooltip: `The asset name. These names are simplified for a smoother UI.
                                       <a href='https://docs.deltaprime.io/integrations/tokens' target='_blank'>More information</a>.`
          },
          {
            label: 'Deposit',
            sortable: false,
            class: 'deposit',
            id: 'DEPOSIT',
          },
          {
            label: 'APY',
            sortable: false,
            class: 'apy',
            id: 'APY',
          },
          {
            label: 'Pool size',
            sortable: false,
            class: 'tvl',
            id: 'TVL',
          },
          {
            label: 'Utilisation',
            sortable: false,
            class: 'utilisation',
            id: 'UTILISATION',
          },
          {
            label: ''
          },
          {
            label: 'Actions',
            sortable: false,
            class: 'actions',
            id: 'ACTIONS'
          },
        ]
      };
    },

  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.pools-beta-component {

  .main-content {
    margin-top: 30px;

    .title {
      margin-top: 55px;
      font-size: $font-size-xxl;
      font-weight: bold;
      margin-bottom: 31px;
    }

    .pools {
      width: 100%;
      margin-top: 65px;
      padding: 0 53px;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;

      .pools-table {
        width: 100%;

        .loader-container {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          margin-top: 40px;
        }
      }
    }
  }
}


</style>