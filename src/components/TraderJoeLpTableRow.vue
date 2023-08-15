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
        <img class="asset__icon" :src="getAssetIcon(lpToken.primary)">{{ formatTokenBalance(lpToken.primaryBalance ? lpToken.primaryBalance : 0, 8, true) }}
        <img class="asset__icon" :src="getAssetIcon(lpToken.secondary)">{{ formatTokenBalance(lpToken.secondaryBalance ? lpToken.secondaryBalance : 0, 8, true) }}
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
        <DeltaIcon :class="['action-button', 1 || !hasSmartLoanContract || inProcess || !healthLoaded ? 'action-button--disabled' : '']"
                   :icon-src="'src/assets/icons/plus.svg'" :size="26"
                   v-tooltip="{content: 'Add LP from wallet', classes: 'button-tooltip'}"
                   v-on:click.native="actionClick('ADD_FROM_WALLET')"></DeltaIcon>
        <IconButtonMenuBeta
            v-if="moreActionsConfig"
            class="actions__icon-button"
            :config="moreActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="inProcess || !healthLoaded">
        </IconButtonMenuBeta>
      </div>
    </div>
  </div>
</template>

<script>
import DoubleAssetIcon from './DoubleAssetIcon.vue';
import IconButtonMenuBeta from './IconButtonMenuBeta.vue';
import config from '../config';
import { mapActions, mapState } from 'vuex';
import TraderJoeAddLiquidityModal from './TraderJoeAddLiquidityModal.vue';
import TraderJoeRemoveLiquidityModal from './TraderJoeRemoveLiquidityModal.vue';
import { calculateMaxApy, formatUnits, fromWei, parseUnits } from '../utils/calculate';
import DeltaIcon from './DeltaIcon.vue';
import { ethers } from 'ethers';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

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
    this.watchAssetBalancesDataRefreshEvent();
    this.watchHealth();
    this.watchAssetApysRefresh();
    this.watchHardRefreshScheduledEvent();
    this.setupApr();
  },

  data() {
    return {
      tokenX: null,
      tokenY: null,
      moreActionsConfig: null,
      rowExpanded: false,
      apr: 0,
      tvl: 0,
      inProcess: false,
      healthLoaded: false,
      feesClaimable: 0,
      activeId: null
    };
  },

  computed: {
    ...mapState('fundsStore', [
      'assets',
      'health',
      'assetBalances',
      'smartLoanContract',
    ]),
    ...mapState('stakeStore', ['farms']),
    ...mapState('network', ['provider', 'account']),
    ...mapState('serviceRegistry', [
      'dataRefreshEventService',
      'progressBarService',
      'healthService',
      'traderJoeService'
    ]),

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },

    maxApr() {
      return this.apr;
    },

    firstAsset() {
      return config.ASSETS_CONFIG[this.lpToken.primary];
    },

    secondAsset() {
      return config.ASSETS_CONFIG[this.lpToken.secondary];
    }
  },

  watch: {
    smartLoanContract: {
      handler(smartLoanContract) {
        if (smartLoanContract) {
          this.setupActionsConfiguration();
        }
      },
    },
    assets: {
      handler(assets) {
        if (assets) {
          this.setupTvlAndActiveId();
        }
      },
      immediate: true
    },
  },

  methods: {
    setupActionsConfiguration() {
      this.moreActionsConfig = {
        iconSrc: 'src/assets/icons/icon_a_more.svg',
        tooltip: 'More',
        menuOptions: [
          {
            key: 'ADD_LIQUIDITY',
            name: 'Add Liquidity',
            disabled: !this.hasSmartLoanContract || this.inProcess,
            disabledInfo: 'To create LP token, you need to add some funds from you wallet first'
          },
          {
            key: 'REMOVE_LIQUIDITY',
            name: 'Remove Liquidity',
            disabled: !this.hasSmartLoanContract || this.inProcess
          },
          {
            key: 'WITHDRAW',
            name: 'Withdraw LP to wallet',
            disabled: true || !this.hasSmartLoanContract || !this.lpTokenBalances,
            disabledInfo: 'Coming soon'
          }
        ]
      };
    },

    actionClick(key) {
      if (!this.inProcess && this.healthLoaded) {
        switch (key) {
          case 'ADD_FROM_WALLET':
            this.openAddFromWalletModal();
            break;
          case 'ADD_LIQUIDITY':
            this.openAddLiquidityModal();
            break;
          case 'REMOVE_LIQUIDITY':
            this.openRemoveLiquidityModal();
            break;
        }
      }
    },

    async openAddFromWalletModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      modalInstance.asset = this.lpToken;
      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        // To-do: add LP token from wallet
      });
    },

    openAddLiquidityModal() {
      const modalInstance = this.openModal(TraderJoeAddLiquidityModal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.firstAsset = this.firstAsset;
      modalInstance.secondAsset = this.secondAsset;
      modalInstance.firstAssetBalance = this.assetBalances[this.lpToken.primary];
      modalInstance.secondAssetBalance = this.assetBalances[this.lpToken.secondary];
      modalInstance.activeId = this.activeId;
      modalInstance.binStep = this.lpToken.binStep;
      modalInstance.$on('ADD_LIQUIDITY', addLiquidityEvent => {
        if (this.smartLoanContract) {
          const addLiquidityRequest = this.traderJoeService.getAddLiquidityParameters(
            this.account,
            this.tokenX,
            this.tokenY,
            parseUnits(addLiquidityEvent.tokenXAmount.toString(), this.firstAsset.decimals).toString(),
            parseUnits(addLiquidityEvent.tokenYAmount.toString(), this.secondAsset.decimals).toString(),
            // String(addLiquidityEvent.tokenXAmount),
            // String(addLiquidityEvent.tokenYAmount),
            addLiquidityEvent.distributionMethod,
            this.lpToken.binStep,
            this.activeId,
            addLiquidityEvent.binRange
          );
          this.traderJoeService.addLiquidity({ provider: this.provider, addLiquidityInput: addLiquidityRequest });
          // this.handleTransaction(this.traderJoeService.addLiquidityTraderJoeV2Pool, { addLiquidityInput: addLiquidityRequest }, () => {
          //   this.$forceUpdate();
          // }, (error) => {
          //   this.handleTransactionError(error);
          // }).then(() => {
          //   this.closeModal();
          // });
        }
      });
    },

    openRemoveLiquidityModal() {
      const modalInstance = this.openModal(TraderJoeRemoveLiquidityModal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.lpTokenBalance = Number(this.traderJoeV2LpTokenBalances[this.lpToken.symbol]);
      modalInstance.firstBalance = Number(this.assetBalances[this.lpToken.primary]);
      modalInstance.secondBalance = Number(this.assetBalances[this.lpToken.secondary]);
      modalInstance.tokenAvailableDecimals = this.lpToken.symbol === 'SHLB_USDT.e-USDt_C' ? 18 : 10;
      modalInstance.$on('REMOVE_LIQUIDITY', removeLiquidityEvent => {
        if (this.smartLoanContract) {
          const removeLiquidityRequest = {
            value: removeLiquidityEvent.amount,
            symbol: this.lpToken.symbol,
            method: this.lpToken.removeMethod,
            firstAsset: this.lpToken.primary,
            secondAsset: this.lpToken.secondary,
            minFirstAmount: removeLiquidityEvent.minReceivedFirst.toString(),
            minSecondAmount: removeLiquidityEvent.minReceivedSecond.toString(),
            assetDecimals: config.TRADERJOEV2_LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
            dex: this.lpToken.dex
          };
          this.handleTransaction(this.removeLiquidityTraderJoeV2Pool, {removeLiquidityRequest: removeLiquidityRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    watchAssetBalancesDataRefreshEvent() {
      this.dataRefreshEventService.assetBalancesDataRefreshEvent$.subscribe(() => {
        this.inProcess = false;
        this.$forceUpdate();
      });
    },

    watchHardRefreshScheduledEvent() {
      this.dataRefreshEventService.hardRefreshScheduledEvent$.subscribe(() => {
        this.inProcess = true;
        this.$forceUpdate();
      });
    },

    watchHealth() {
      this.healthService.observeHealth().subscribe(health => {
        this.healthLoaded = true;
      });
    },

    watchAssetApysRefresh() {
      this.dataRefreshEventService.observeAssetApysDataRefresh().subscribe(() => {
        this.setupApr();
      })
    },

    async setupTvlAndActiveId() {
      const tokenX = this.traderJoeService.initializeToken(this.firstAsset);
      const tokenY = this.traderJoeService.initializeToken(this.secondAsset);

      this.tokenX = tokenX;
      this.tokenY = tokenY;

      const LBPairABI = [
        'function getReserves() public view returns (uint128, uint128)',
        'function getActiveId() public view returns (uint24)',
        'function getTokenX() public view returns (address)'
      ];
      const poolContract = new ethers.Contract(this.lpToken.address, LBPairABI, this.provider);
      const [reserves, activeId, firstAsset] = await Promise.all([
        poolContract.getReserves(),
        poolContract.getActiveId(),
        poolContract.getTokenX()
      ]);
      console.log(this.lpToken.symbol, firstAsset);

      const tokenXTVL = formatUnits(reserves[0], this.firstAsset.decimals) * this.firstAsset.price;
      const tokenYTVL = formatUnits(reserves[1], this.secondAsset.decimals) * this.secondAsset.price;

      this.lpToken.tvl = tokenXTVL + tokenYTVL;
      this.activeId = activeId;
    },

    setupApr() {
      if (!this.lpToken.apy) return;
      this.apr = this.lpToken.apy;
    },

    handleTransactionError(error) {
      if (error.code === 4001 || error.code === -32603) {
        this.progressBarService.emitProgressBarCancelledState();
      } else {
        this.progressBarService.emitProgressBarErrorState();
      }
      this.closeModal();
      this.inProcess = false;
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
