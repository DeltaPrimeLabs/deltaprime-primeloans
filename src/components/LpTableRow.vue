<template>
  <div class="lp-table-row-component" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="lpToken">
      <div class="table__cell asset">
        <DoubleAssetIcon :primary="lpToken.primary" :secondary="lpToken.secondary"></DoubleAssetIcon>
        <div class="asset__info">
          <div class="asset__name">{{ lpToken.primary }} - {{ lpToken.secondary }}</div>
          <div class="asset__loan">
            on {{ lpToken.dex }}
          </div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value balance">
        <template v-if="lpBalances">
          <div class="double-value__pieces">
            <LoadedValue :check="() => lpBalances[lpToken.symbol] != null"
                         :value="formatTokenBalance(lpBalances[lpToken.symbol], 10)"></LoadedValue>
          </div>
          <div class="double-value__usd">
            <span v-if="lpBalances[lpToken.symbol]">{{ lpBalances[lpToken.symbol] * lpToken.price | usd }}</span>
          </div>
        </template>
        <template v-if="!lpBalances || !lpBalances[lpToken.symbol]">
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value loan">
        {{ lpToken.apr | percent }}
      </div>

      <div class="table__cell">
      </div>

      <div class="table__cell price">
        {{ lpToken.price | usd }}
      </div>

      <div></div>

      <div class="table__cell actions">
        <IconButtonMenuBeta
          class="actions__icon-button"
          v-for="(actionConfig, index) of actionsConfig"
          v-bind:key="index"
          :config="actionConfig"
          v-on:iconButtonClick="actionClick">
        </IconButtonMenuBeta>
      </div>
    </div>
    <div class="chart-container" v-if="showChart">
      <SmallBlock v-on:close="toggleChart()">
        <Chart :data-points="lpToken.priceGraphData"
               :line-width="3"
               :min-y="lpToken.minPrice"
               :max-y="lpToken.maxPrice"
               :positive-change="lpToken.todayPriceChange > 0">
        </Chart>
      </SmallBlock>
    </div>
  </div>
</template>

<script>
import DoubleAssetIcon from './DoubleAssetIcon';
import LoadedValue from './LoadedValue';
import SmallBlock from './SmallBlock';
import Chart from './Chart';
import IconButtonMenuBeta from './IconButtonMenuBeta';
import ColoredValueBeta from './ColoredValueBeta';
import SmallChartBeta from './SmallChartBeta';
import AddFromWalletModal from "./AddFromWalletModal";
import config from "../config";
import {mapActions, mapState} from "vuex";
import ProvideLiquidityModal from "./ProvideLiquidityModal";
import RemoveLiquidityModal from "./RemoveLiquidityModal";
import WithdrawModal from "./WithdrawModal";

export default {
  name: 'LpTableRow',
  components: {
    DoubleAssetIcon,
    LoadedValue,
    SmallBlock,
    Chart,
    IconButtonMenuBeta,
    ColoredValueBeta,
    SmallChartBeta
  },
  props: {
    lpToken: null
  },

  mounted() {
    this.setupActionsConfiguration();
  },

  data() {
    return {
      actionsConfig: null,
      showChart: false,
      rowExpanded: false,
    };
  },

  computed: {
    ...mapState('fundsStore', ['health', 'lpBalances', 'smartLoanContract', 'fullLoanStatus', 'assetBalances']),
  },

  methods: {
    ...mapActions('fundsStore', ['fund', 'withdraw', 'provideLiquidity', 'removeLiquidity']),
    setupActionsConfiguration() {
      this.actionsConfig = [
        {
          iconSrc: 'src/assets/icons/plus.svg',
          tooltip: 'Add / Provide',
          menuOptions: [
            {
              key: 'ADD_FROM_WALLET',
              name: 'Add from wallet'
            },
            {
              key: 'PROVIDE_LIQUIDITY',
              name: 'Provide liquidity'
            },
          ]
        },
        {
          iconSrc: 'src/assets/icons/minus.svg',
          tooltip: 'Withdraw / Remove',
          menuOptions: [
            {
              key: 'WITHDRAW',
              name: 'Withdraw',
            },
            {
              key: 'REMOVE_LIQUIDITY',
              name: 'Remove liquidity',
            }
          ]
        },
      ];
    },

    toggleChart() {
      if (this.rowExpanded) {
        this.showChart = false;
        this.rowExpanded = false;
      } else {
        this.rowExpanded = true;
        setTimeout(() => {
          this.showChart = true;
        }, 200);
      }
    },

    actionClick(key) {
      switch (key) {
        case 'ADD_FROM_WALLET':
          this.openAddFromWalletModal();
          break;
        case 'PROVIDE_LIQUIDITY':
          this.openProvideLiquidityModal();
          break;
        case 'WITHDRAW':
          this.openWithdrawModal();
          break;
        case 'REMOVE_LIQUIDITY':
          this.openRemoveLiquidityModal();
          break;
      }
    },

    //TODO: duplicated code
    openAddFromWalletModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      modalInstance.asset = this.lpToken;
      modalInstance.loan = this.debt;
      modalInstance.thresholdWeightedValue = this.thresholdWeightedValue;
      modalInstance.isLP = true;
      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
              const fundRequest = {
                value: String(addFromWalletEvent.value),
                asset: this.lpToken.symbol,
                assetDecimals: config.LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
              };
              this.handleTransaction(this.fund, {fundRequest: fundRequest}).then(() => {
                this.closeModal();
              });
          }
      });
    },

    //TODO: duplicated code
    openWithdrawModal() {
      const modalInstance = this.openModal(WithdrawModal);
      modalInstance.asset = this.lpToken;
      modalInstance.health = this.health;
      modalInstance.isLP = true;
      modalInstance.$on('WITHDRAW', withdrawEvent => {
        const withdrawRequest = {
          value: String(withdrawEvent.value),
          asset: this.lpToken.symbol,
          assetDecimals: config.LP_ASSETS_CONFIG[this.lpToken.symbol].decimals
        }

        this.handleTransaction(this.withdraw, {withdrawRequest: withdrawRequest}).then(() => {
          this.closeModal();
        });
      });
    },

    openProvideLiquidityModal() {
      const modalInstance = this.openModal(ProvideLiquidityModal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.firstAssetBalance = this.assetBalances[this.lpToken.primary];
      modalInstance.secondAssetBalance = this.assetBalances[this.lpToken.secondary];
      modalInstance.$on('PROVIDE_LIQUIDITY', provideLiquidityEvent => {
        if (this.smartLoanContract) {
          const lpRequest = {
            symbol: this.lpToken.symbol,
            firstAsset: this.lpToken.primary,
            secondAsset: this.lpToken.secondary,
            firstAmount: provideLiquidityEvent.firstAmount,
            secondAmount: provideLiquidityEvent.secondAmount,
            dex: this.lpToken.dex
        };
          this.handleTransaction(this.provideLiquidity, {lpRequest: lpRequest}).then(() => {
            this.closeModal();
          });
        }
      });
    },

    //TODO: duplicated code
    openRemoveLiquidityModal() {
      const modalInstance = this.openModal(RemoveLiquidityModal);
      modalInstance.lpToken = this.lpToken;
      console.log(this.lpToken.symbol)
      modalInstance.lpTokenBalance = Number(this.lpBalances[this.lpToken.symbol]);
      modalInstance.firstBalance = Number(this.assetBalances[this.lpToken.primary]);
      modalInstance.secondBalance = Number(this.assetBalances[this.lpToken.secondary]);
      modalInstance.$on('REMOVE_LIQUIDITY', removeEvent => {
        const removeRequest = {
          value: removeEvent.amount,
          symbol: this.lpToken.symbol,
          firstAsset: this.lpToken.primary,
          secondAsset: this.lpToken.secondary,
          minFirstAmount: removeEvent.minReceivedFirst,
          minSecondAmount: removeEvent.minReceivedSecond,
          assetDecimals: config.LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
          dex: this.lpToken.dex
        }

        this.handleTransaction(this.removeLiquidity, {removeRequest: removeRequest}).then(() => {
          this.closeModal();
        });
      });
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.lp-table-row-component {
  height: 60px;
  transition: all 200ms;

  &.expanded {
    height: 387px;
  }

  .table__row {
    display: grid;
    grid-template-columns: 20% repeat(2, 1fr) 20% 1fr 76px 102px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: linear-gradient(to right, #dfe0ff 43%, #ffe1c2 62%, #ffd3e0 79%);
    border-image-slice: 1;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.asset {
        align-items: center;

        .asset__icon {
          width: 20px;
          height: 20px;
        }

        .asset__info {
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-left: 8px;
          font-weight: 500;
        }

        .asset__loan {
          font-size: $font-size-xxs;
          color: $medium-gray;
        }
      }

      &.balance {
        align-items: flex-end;
      }

      &.loan {
        align-items: flex-end;
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

        .double-value__pieces {
          font-size: $font-size-xsm;
          font-weight: 600;
        }

        .double-value__usd {
          font-size: $font-size-xxs;
          color: $medium-gray;
          font-weight: 500;
        }

        &.loan {
          .double-value__pieces {
            font-weight: 500;
          }
        }
      }

      .no-value-dash {
        height: 1px;
        width: 15px;
        background-color: $medium-gray;
      }
    }
  }

  .chart-container {
    margin: 2rem 0;

    .small-block-wrapper {
      height: unset;
    }
  }
}

</style>