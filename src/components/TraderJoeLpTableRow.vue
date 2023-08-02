<template>
  <div class="traderJoe-lp-table-row-component" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="lpToken">
      <div class="table__cell asset">
        <DoubleAssetIcon :primary="lpToken.primary" :secondary="lpToken.secondary"></DoubleAssetIcon>
        <div class="asset__info">
          <div class="asset__name">{{ lpToken.primary }} - {{ lpToken.secondary }}</div>
          <div class="asset__dex">
            by {{ lpToken.dex }}
          </div>
        </div>
      </div>

      <!-- To-do: Show price graph or similar one on click -->
      <div class="table__cell liquidity"></div>

      <div class="table__cell table__cell--double-value fees">
        {{ feesClaimable | usd }}
      </div>

      <div class="table__cell composition">
        <img class="asset__icon" :src="getAssetIcon(lpToken.primary)">{{ formatTokenBalance(lpToken.primaryBalance != null ? lpToken.primaryBalance : 0, 8, true) }}
        <img class="asset__icon" :src="getAssetIcon(lpToken.secondary)">{{ formatTokenBalance(lpToken.secondaryBalance != null ? lpToken.secondaryBalance : 0, 8, true) }}
      </div>

      <div class="table__cell table__cell--double-value loan">
        {{ lpToken.tvl | usd }}
      </div>

      <div class="table__cell table__cell--double-value apr">
        {{ apr / 100 | percent }}
      </div>

      <div class="table__cell table__cell--double-value max-apr">
        {{ maxApr | percent }}
      </div>

      <div class="table__cell"></div>

      <div class="table__cell actions">
        <DeltaIcon :class="['action-button', isPending || !healthLoaded ? 'action-button--disabled' : '']"
                   :icon-src="'src/assets/icons/plus.svg'" :size="26"
                   v-tooltip="{content: 'Add Liquidity', classes: 'button-tooltip'}"
                   v-on:click.native="actionClick('ADD_LIQUIDITY')"></DeltaIcon>
        <IconButtonMenuBeta
            v-if="moreActionsConfig"
            class="actions__icon-button"
            :config="moreActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="isPending || !healthLoaded">
        </IconButtonMenuBeta>
      </div>
    </div>
  </div>
</template>

<script>
import DoubleAssetIcon from './DoubleAssetIcon.vue';
import IconButtonMenuBeta from './IconButtonMenuBeta.vue';
import config from '../config';
import { mapState } from 'vuex';
import TraderJoeAddLiquidityModal from './TraderJoeAddLiquidityModal.vue';
import TraderJoeRemoveLiquidityModal from './TraderJoeRemoveLiquidityModal.vue';
import { calculateMaxApy, fromWei } from '../utils/calculate';
import DeltaIcon from './DeltaIcon.vue';

export default {
  name: 'TraderJoeLpTableRow',
  components: {
    DeltaIcon,
    DoubleAssetIcon,
    IconButtonMenuBeta
  },
  props: {
    lpToken: null
  },

  async mounted() {
    this.setupActionsConfiguration();
    this.watchHealth();
  },

  data() {
    return {
      moreActionsConfig: null,
      rowExpanded: false,
      apr: 0,
      tvl: 0,
      isPending: false,
      healthLoaded: false,
      feesClaimable: 0
    };
  },

  computed: {
    ...mapState('stakeStore', ['farms']),
    ...mapState('network', ['provider', 'account']),
    ...mapState('serviceRegistry', ['progressBarService', 'healthService']),

    maxApr() {
      return this.apr;
    }
  },

  watch: {},

  methods: {
    setupActionsConfiguration() {
      this.moreActionsConfig = {
        iconSrc: 'src/assets/icons/icon_a_more.svg',
        tooltip: 'More',
        menuOptions: [
          {
            key: 'REMOVE_LIQUIDITY',
            name: 'Remove Liquidity',
            disabled: this.isPending
          },
          {
            key: 'WITHDRAW',
            name: 'Claim Fees',
            disabled: this.isPending || this.feesClaimable === 0,
            disabledInfo: 'No Fees Claimable'
          }
        ]
      };
    },

    actionClick(key) {
      if (!this.isPending && this.healthLoaded) {
        switch (key) {
          case 'ADD_LIQUIDITY':
            this.openAddLiquidityModal();
            break;
          case 'REMOVE_LIQUIDITY':
            this.openRemoveLiquidityModal();
            break;
        }
      }
    },

    openAddLiquidityModal() {
      const modalInstance = this.openModal(TraderJoeAddLiquidityModal);
      modalInstance.$on('ADD_LIQUIDITY', provideLiquidityEvent => {
        const provideLiquidityRequest = {
          symbol: this.lpToken.symbol,
          method: this.lpToken.addMethod,
          firstAsset: this.lpToken.primary,
          secondAsset: this.lpToken.secondary,
          firstAmount: provideLiquidityEvent.firstAmount.toString(),
          secondAmount: provideLiquidityEvent.secondAmount.toString(),
          addedLiquidity: provideLiquidityEvent.addedLiquidity,
        };
        // this.handleTransaction(this.provideLiquidityTraderJoePool, {provideLiquidityRequest: provideLiquidityRequest}, () => {
        //   this.$forceUpdate();
        // }, (error) => {
        //   this.handleTransactionError(error);
        // }).then(() => {
        // });
      });
    },

    openRemoveLiquidityModal() {
      const modalInstance = this.openModal(TraderJoeRemoveLiquidityModal);
      modalInstance.$on('REMOVE_LIQUIDITY', removeEvent => {
        const removeLiquidityRequest = {
          value: removeEvent.amount,
          symbol: this.lpToken.symbol,
          method: this.lpToken.removeMethod,
          firstAsset: this.lpToken.primary,
          secondAsset: this.lpToken.secondary,
          minFirstAmount: removeEvent.minReceivedFirst.toString(),
          minSecondAmount: removeEvent.minReceivedSecond.toString(),
          assetDecimals: config.TRADERJOE_LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
          dex: this.lpToken.dex
        };
        // this.handleTransaction(this.removeLiquidityTraderJoePool, {removeLiquidityRequest: removeLiquidityRequest}, () => {
        //   this.$forceUpdate();
        // }, (error) => {
        //   this.handleTransactionError(error);
        // }).then(() => {
        // });
      });
    },

    watchHealth() {
      this.healthService.observeHealth().subscribe(health => {
        this.healthLoaded = true;
      });
    },

    handleTransactionError(error) {
      if (error.code === 4001 || error.code === -32603) {
        this.progressBarService.emitProgressBarCancelledState();
      } else {
        this.progressBarService.emitProgressBarErrorState();
      }
      this.closeModal();
      this.isPending = false;
      this.isBalanceEstimated = false;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.traderJoe-lp-table-row-component {
  height: 60px;
  transition: all 200ms;
  border-style: solid;
  border-width: 0 0 2px 0;
  border-image-source: var(--asset-table-row__border);
  border-image-slice: 1;

  &.expanded {
    height: 404px;
  }

  .table__row {
    display: grid;
    grid-template-columns: 153px 150px 150px 170px 140px repeat(2, 1fr) 35px 80px;
    height: 60px;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.asset {
        align-items: center;

        .asset__icon {
          width: 20px;
          height: 20px;
          opacity: var(--asset-table-row__icon-opacity);
        }

        .asset__info {
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-left: 8px;
          font-weight: 500;
        }

        .asset__dex {
          font-size: $font-size-xxs;
          color: var(--asset-table-row__asset-loan-color);
        }
      }

      &.fees {
        align-items: flex-end;
      }

      &.liquidity {
        align-items: flex-end;
      }

      &.composition {
        display: flex;
        align-items: center;
        justify-content: flex-end;

        img {
          margin-left: 5px;
        }
      }

      &.farmed {
        align-items: flex-end;
      }

      &.loan, &.apr, &.max-apr {
        align-items: flex-end;
      }

      &.max-apr {
        font-weight: 600;
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
          cursor: pointer;
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
      }

      .action-button {
        cursor: pointer;
        background: var(--icon-button-menu-beta__icon-color--default);

        &:not(:last-child) {
          margin-right: 12px;
        }

        &:hover {
          background: var(--icon-button-menu-beta__icon-color-hover--default);
        }

        &.action-button--disabled {
          background: var(--icon-button-menu-beta__icon-color--disabled);
          cursor: default;
          pointer-events: none;
        }
      }
    }
  }

  .asset__icon {
    height: 22px;
    width: 22px;
    border-radius: 50%;
    margin-right: 9px;
  }
}

</style>
