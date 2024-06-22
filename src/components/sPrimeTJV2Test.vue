<template>
<div class="ltip-stats-bar-component">
  <div class="ltip__title">sPRIME TEST</div>
  <Button :label="'MINT'"
          v-on:click="openMintSPrimeModal('USDC')">
  </Button>

</div>
</template>

<script>


import BarGaugeBeta from './BarGaugeBeta.vue';
import InfoIcon from './InfoIcon.vue';
import LTIP_DISTRIBUTED_ARBITRUM from "../data/arbitrum/ltip/LTIP_EPOCH_2.json";
import {fromWei} from "../utils/calculate";
import {mapActions, mapState} from "vuex";
import {wrapContract} from "../utils/blockchain";
import config from "../config";
import {maxInt8} from "viem";
import {combineLatest, endWith} from "rxjs";
import ClaimTraderJoeRewardsModal from "./ClaimTraderJoeRewardsModal.vue";
import Button from "./Button.vue";

export default {
  name: 'sPrimeTJV2Test',
  components: {Button, InfoIcon, BarGaugeBeta},
  data() {
    return {
    }
  },
  mounted() {
  },
  computed: {
    ...mapState('serviceRegistry', ['traderJoeService']),
  },
  methods: {
    ...mapActions('poolStore', [
      'sPrimeTjV2Mint'
    ]),
    async openMintSPrimeModal(secondAsset) {
      // const modalInstance = this.openModal(ClaimTraderJoeRewardsModal);
      // modalInstance.lpToken = this.lpToken;

      const [, activeId] = await this
          .traderJoeService
          .getLBPairReservesAndActiveBin(config.SPRIME_CONFIG.TRADERJOEV2[secondAsset].lbAddress, this.provider);

      // modalInstance.$on('MINT', sPrimeMintEvent => {
        let sPrimeMintRequest = {
          secondAsset: secondAsset,
          isRebalance: true,
          amountPrime: 0.0001,
          amountSecond: 0.0001,
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

  },
  watch: {

  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.ltip-stats-bar-component {
  display: flex;
  flex-direction: column;
  height: 130px;
  margin-top: 30px;
  padding: 0 53px;
  border-radius: 35px;
  background-color: var(--ltip-stats-bar__background);
  box-shadow: var(--ltip-stats-bar__box-shadow);

  .ltip__title {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    width: 100%;
    color: var(--ltip-stats-bar-text__color);
    font-size: $font-size-sm;
    font-weight: 600;
    padding: 6px 0;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;
  }

  .stats-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 22px 0 27px 0;
    margin: 0 -40px;

    .stat__entry {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: $font-size-xsm;
      font-weight: 500;
      color: var(--ltip-stats-bar-text__color);
      width: 100%;

      .stat-label {
        display: flex;
        flex-direction: row;
        align-items: center;
        font-size: $font-size-xsm;
        font-weight: 500;
        color: var(--ltip-stats-bar-text__color);
        margin-bottom: 12px;

        .info__icon {
          margin-left: 5px;
        }
      }

      .stat-value {
        display: flex;
        flex-direction: row;
        align-items: center;
        font-size: $font-size-xsm;
        font-weight: 600;
        color: var(--ltip-stats-bar-value__color);

        .incentives-icon {
          width: 16px;
          height: 16px;
          margin-left: 5px;
        }

        .shine-icon {
          width: 20px;
          height: 20px;
          margin-left: 5px;
          background-image: var(--ltip-stats-bar-value-icon);
        }
      }
    }
  }
}

</style>
