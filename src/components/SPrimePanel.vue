<template>
  <div class="sprime-panel-component">
    <div class="sprime-panel__actions">
      <div class="sprime">
        <img src="src/assets/icons/sprime-icon.svg">
        $sPRIME
      </div>
      <div class="actions">
        <FlatButton v-on:buttonClick="openMintSPrimeModal()" :active="true">mint</FlatButton>
        <FlatButton v-on:buttonClick="openRebalanceSPrimeModal()" :active="true">rebalance</FlatButton>
        <FlatButton v-on:buttonClick="openRedeemSPrimeModal()" :active="true">redeem</FlatButton>
      </div>
    </div>
    <div class="sprime-panel__body">
      <div class="stats">
        <div class="stat">
          <div class="stat__title">Total value</div>
          <div class="stat__value">{{ formatTokenBalance(value, 18, true) }}</div>
        </div>
        <div class="stat">
          <div class="stat__title">Revenue received</div>
          <div class="stat__value">{{ 50.31 | usd }}</div>
        </div>
        <div class="stat">
          <div class="stat__title">YTD APR</div>
          <div class="stat__value">{{ 0.15512 | percent }}</div>
        </div>
      </div>
      <div class="distribution">
        Distribution
      </div>
      <div class="governance">
        <div class="governance__title">Governance power</div>
        <div class="power__gauge">
          <div class="gauge__value">
            {{ governancePoints }}
          </div>
        </div>
      </div>
      <div class="rates">
        <div class="rate">
          <div class="rate__title">Accrual rate (yearly)</div>
          <div class="rate__value">{{ governanceRate }}</div>
        </div>
        <div class="rate">
          <div class="rate__title">Max. accrual rate</div>
          <div class="rate__value">58</div>
          <div class="rate__extra-info">(Borrow 10$ more)</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>

import FlatButton from './FlatButton.vue';
import {mapActions, mapState} from "vuex";
import config from "../config";
import {combineLatest} from "rxjs";

export default {
  name: 'SPrimePanel',
  components: {FlatButton},
  props: {
    isPrimeAccount: false
  },
  data() {
    return {
      dex: null,
      secondAsset: null,
      sPrimeConfig: null,
      value: null,
      governancePoints: null,
      governanceRate: null
    };
  },
  mounted() {
    this.dex = config.SPRIME_CONFIG.default;
    this.secondAsset = config.SPRIME_CONFIG[this.dex].default;
    this.sPrimeConfig = config.SPRIME_CONFIG[this.dex][this.secondAsset];

    combineLatest([
      this.accountService.observeAccountLoaded(),
      this.providerService.observeProviderCreated()
    ]).subscribe(value => {
      this.fetchSPrimeData();
    });

    this.sPrimeService.observeSPrimeValue().subscribe(value => {
      this.value = value
    });

    this.accountService.observeAccountLoaded().subscribe(() => {
      this.fetchVPrimeData();
    });

    this.vPrimeService.observeVPrimePoints().subscribe(points => {
      this.governancePoints = points;
    });

    this.vPrimeService.observeVPrimeRate().subscribe(rate => {
      this.governanceRate = rate;
    });
  },
  watch: {},
  computed: {
    ...mapState('serviceRegistry', ['sPrimeService', 'vPrimeService', 'providerService', 'accountService', 'traderJoeService']),
    ...mapState('network', ['provider', 'account']),
  },
  methods: {
    ...mapActions('sPrimeStore', [
      'sPrimeTjV2Mint',
      'sPrimeTjV2Rebalance',
      'sPrimeTjV2Redeem'
    ]),
    async openMintSPrimeModal() {
      const [, activeId] = await this
          .traderJoeService
          .getLBPairReservesAndActiveBin(this.sPrimeConfig.lbAddress, this.provider);

      // modalInstance.$on('MINT', sPrimeMintEvent => {
      let sPrimeMintRequest = {
        sPrimeAddress: this.sPrimeConfig.sPrimeAddress,
        secondAsset: this.secondAsset,
        isRebalance: false,
        amountPrime: 0.01,
        amountSecond: 0.013135,
        idSlippage: 10,
        slippage: 5,
        activeId: activeId
      };
      this.handleTransaction(this.sPrimeTjV2Mint, { sPrimeMintRequest: sPrimeMintRequest }, () => {
        this.$forceUpdate();
      }, (error) => {
        this.handleTransactionError(error);
      }).then(() => {
      });
      // });
    },
    async openRebalanceSPrimeModal() {
      const [, activeId] = await this
          .traderJoeService
          .getLBPairReservesAndActiveBin(this.sPrimeConfig.lbAddress, this.provider);

      // modalInstance.$on('REBALANCE', sPrimeRebalanceEvent => {
      let sPrimeRebalanceRequest = {
        sPrimeAddress: this.sPrimeConfig.sPrimeAddress,
        secondAsset: this.secondAsset,
        isRebalance: true,
        idSlippage: 10,
        slippage: 5,
        activeId: activeId
      };
      this.handleTransaction(this.sPrimeTjV2Rebalance, { sPrimeRebalanceRequest: sPrimeRebalanceRequest }, () => {
        this.$forceUpdate();
      }, (error) => {
        this.handleTransactionError(error);
      }).then(() => {
      });
      // });
    },
    async openRedeemSPrimeModal() {
      // modalInstance.$on('REDEEM', sPrimeRebalanceEvent => {
      let sPrimeRedeemRequest = {
        sPrimeAddress: this.sPrimeConfig.sPrimeAddress,
        secondAsset: this.secondAsset,
        share: '0.0000000000000001'
      };
      this.handleTransaction(this.sPrimeTjV2Redeem, { sPrimeRedeemRequest: sPrimeRedeemRequest }, () => {
        this.$forceUpdate();
      }, (error) => {
        this.handleTransactionError(error);
      }).then(() => {
      });
      // });
    },
    fetchSPrimeData() {
      this.sPrimeService.emitRefreshSPrimeData(this.provider, this.sPrimeConfig.sPrimeAddress, this.dex, this.secondAsset, this.account);
    },
    fetchVPrimeData() {
      this.vPrimeService.emitRefreshVPrimeData(config.VPRIME_CONFIG.address, this.account);
    }
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.sprime-panel-component {
  display: flex;
  flex-direction: column;
  border-radius: 35px;
  background-color: var(--ltip-stats-bar__background);
  box-shadow: var(--ltip-stats-bar__box-shadow);
  margin-top: 30px;

  .sprime-panel__actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 16px 0;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;

    .sprime {
      margin-right: 30px;
    }

    .actions {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;

      .flat-button-component:not(:last-child) {
        margin-right: 10px;
      }
    }
  }

  .sprime-panel__body {
    padding: 30px 50px;
    display: grid;
    grid-template-columns: 250px 1fr 280px 170px;

    .stats {
      display: flex;
      flex-direction: column;
      border-style: solid;
      border-width: 0 2px 0 0;
      border-image-source: var(--stats-bar-beta__divider-background);
      border-image-slice: 1;

      .stat {
        display: flex;
        flex-direction: column;
        margin-bottom: 24px;

        .stat__title {
          font-size: 16px;
          font-weight: 500;
          color: #696969;
        }

        .stat__value {
          font-size: 18px;
          font-weight: 500;
          color: #000;
        }
      }
    }

    .distribution {
      border-style: solid;
      border-width: 0 2px 0 0;
      border-image-source: var(--stats-bar-beta__divider-background);
      border-image-slice: 1;
    }

    .governance {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;


      .power__gauge {
        width: 130px;
        height: 130px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        box-shadow: 2px 2px 10px 0 rgba(191, 188, 255, 0.9);
        border-radius: 65px;
        border-style: solid;
        border-width: 2px;
        border-image-source: linear-gradient(to right, #dfe0ff, #ffe1c2 48%, #ffd3e0);
        border-image-slice: 1;

        .gauge__value {
          font-size: 44px;
          font-weight: 600;
          color: #9a97ff;
        }
      }
    }

    .rates {
      .rate {
        display: flex;
        flex-direction: column;

        &:not(:last-child) {
          margin-bottom: 40px;
        }

        .rate__title {
          font-size: 16px;
          font-weight: 500;
          color: #696969;
        }

        .rate__value {
          font-size: 18px;
          font-weight: 500;
          color: #000;
        }

        .rate__extra-info {
          font-size: 14px;
          font-weight: 500;
          color: #696969;
        }
      }
    }
  }
}


</style>
