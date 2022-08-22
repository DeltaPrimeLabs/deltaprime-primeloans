<template>
  <div class="pools-beta-component">
    <div class="container">
      <div class="main-content">
        <Block :bordered="true">
          <div class="title">Deposits</div>
          <NameValueBadgeBeta :name="'All deposits'">{{ totalTVL | usd }}</NameValueBadgeBeta>
          <div class="pools">
            <div class="pools-table" v-if="funds">
              <div class="pools-table__header">
                <div class="header__cell asset">Asset</div>
                <div class="header__cell deposit">Deposit</div>
                <div class="header__cell apy">APY</div>
                <div class="header__cell interest">Interest</div>
                <div class="header__cell tvl">Pool size</div>
                <div></div>
                <div class="header__cell actions">Actions</div>
              </div>
              <div class="pools-table__body">
                <PoolsTableRowBeta v-for="pool in pools" v-bind:key="pool.asset.symbol"
                                   :pool="pool"></PoolsTableRowBeta>
              </div>
            </div>
            <div v-if="!funds">
              <VueLoadersBallBeat color="#A6A3FF" scale="1.5"></VueLoadersBallBeat>
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
import redstone from 'redstone-api';
import {fromWei} from '../utils/calculate';
import {mapActions, mapState} from 'vuex';

export default {
  name: 'PoolsBeta',
  components: {
    PoolsTableRowBeta,
    Block,
    NameValueBadgeBeta
  },
  async mounted() {
    if (window.provider) {
      await this.fundsStoreSetup();
      await this.poolStoreSetup();
      this.setupPools();
    } else {
      setTimeout(async () => {
        await this.fundsStoreSetup();
        await this.poolStoreSetup();
        this.setupPools();
      }, 1000);

    }
  },

  data() {
    return {
      pools: null,
      funds: config.ASSETS_CONFIG,
      totalTVL: 0,
    };
  },
  computed: {
    ...mapState('fundsStore', ['assets']),
    ...mapState('poolStore', ['pool']),
  },

  methods: {
    ...mapActions('poolStore', ['poolStoreSetup']),
    ...mapActions('fundsStore', ['fundsStoreSetup']),
    setupPools() {
      this.pools = [
        {
          asset: config.ASSETS_CONFIG['AVAX'],
          deposit: fromWei(this.pool.deposit),
          apy: fromWei(this.pool.apy),
          interest: 0.0112,
          tvl: fromWei(this.pool.tvl)
        }
      ];
      this.setupTotalTVL();
    },

    async updateFunds(funds) {
      this.funds = funds;
    },

    setupTotalTVL() {
      let totalTVL = 0;
      this.pools.forEach(pool => {
        totalTVL += pool.tvl * pool.asset.price;
      })
      this.totalTVL = totalTVL;
    }
  },
  watch: {
    assets: {
      handler(newFunds) {
        this.updateFunds(newFunds);
      },
      immediate: true
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.pools-beta-component {

  .main-content {
    margin-top: 30px;

    .title {
      font-size: $font-size-xxl;
      font-weight: bold;
      margin-bottom: 31px;
    }

    .pools {
      margin-top: 65px;
      width: 100%;

      .pools-table {
        width: 100%;

        .pools-table__header {
          display: grid;
          grid-template-columns: repeat(3, 1fr) 20% 1fr 76px 102px;
          border-style: solid;
          border-width: 0 0 2px 0;
          border-image-source: linear-gradient(to right, #dfe0ff 43%, #ffe1c2 62%, #ffd3e0 79%);
          border-image-slice: 1;
          padding: 0 0 9px 6px;

          .header__cell {
            display: flex;
            flex-direction: row;
            font-size: $font-size-xsm;
            color: $dark-gray;
            font-weight: 500;

            &.asset {
            }

            &.deposit {
              justify-content: flex-end;
            }

            &.apy {
              justify-content: flex-end;
            }

            &.interest {
              justify-content: center;
              margin-left: 40px;
            }

            &.tvl {
              justify-content: flex-end;
            }

            &.actions {
              justify-content: flex-end;
            }

          }
        }
      }
    }
  }
}


</style>