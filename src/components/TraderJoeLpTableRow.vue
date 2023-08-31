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
        <img class="asset__icon" :src="getAssetIcon(lpToken.primary)">{{ formatTokenBalance(lpToken.primaryBalance ? lpToken.primaryBalance : 0, 4, true) }}
        <img class="asset__icon" :src="getAssetIcon(lpToken.secondary)">{{ formatTokenBalance(lpToken.secondaryBalance ? lpToken.secondaryBalance : 0, 4, true) }}
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
        <IconButtonMenuBeta
            class="actions__icon-button"
            v-if="addActionsConfig"
            :config="addActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="inProcess || !healthLoaded">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
            class="actions__icon-button"
            v-if="removeActionsConfig"
            :config="removeActionsConfig"
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
import { ethers, BigNumber } from 'ethers';
import AddTraderJoeV2FromWalletModal from "./AddTraderJoeV2FromWalletModal.vue";
import WithdrawTraderJoeV2Modal from "./WithdrawTraderJoeV2Modal.vue";
import LB_TOKEN from '/artifacts/contracts/interfaces/joe-v2/ILBToken.sol/ILBToken.json'

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
    this.setupAddActionsConfiguration();
    this.setupRemoveActionsConfiguration();
    this.watchRefreshLP();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchHealth();
    this.watchAssetApysRefresh();
    this.watchHardRefreshScheduledEvent();
    this.initAccount();
  },

  data() {
    return {
      tokenX: null,
      tokenY: null,
      addActionsConfig: null,
      removeActionsConfig: null,
      rowExpanded: false,
      userBins: null,
      userBalances: null,
      apr: 0,
      tvl: 0,
      inProcess: false,
      healthLoaded: false,
      feesClaimable: 0,
      activeId: null,
      hasBinsInPool: false,
      account: null
    };
  },

  computed: {
    ...mapState('network', ['provider']),
    ...mapState('fundsStore', [
      'assets',
      'health',
      'assetBalances',
      'smartLoanContract',
    ]),
    ...mapState('stakeStore', ['farms']),
    ...mapState('poolStore', ['pools']),
    ...mapState('serviceRegistry', [
      'dataRefreshEventService',
      'progressBarService',
      'healthService',
      'lpService',
      'traderJoeService',
      'accountService'
    ]),

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },

    maxApr() {
      return calculateMaxApy(this.pools, this.apr / 100);
    },

    firstAsset() {
      return config.ASSETS_CONFIG[this.lpToken.primary];
    },

    secondAsset() {
      return config.ASSETS_CONFIG[this.lpToken.secondary];
    }
  },

  methods: {
    ...mapActions('fundsStore', [
        'fundLiquidityTraderJoeV2Pool',
        'addLiquidityTraderJoeV2Pool',
        'withdrawLiquidityTraderJoeV2Pool',
        'removeLiquidityTraderJoeV2Pool'
    ]),
    watchRefreshLP() {
      this.lpService.observeRefreshLp().subscribe(async (lpType) => {
        if (lpType !== 'TJV2') return;
        await this.setupPool();
        this.setupAddActionsConfiguration();
        this.setupRemoveActionsConfiguration();
        this.setupApr();
      })
    },
    setupAddActionsConfiguration() {
      this.addActionsConfig =   {
        iconSrc: 'src/assets/icons/plus.svg',
        tooltip: 'Add',
        menuOptions: [
          {
            key: 'ADD_FROM_WALLET',
            name: 'Add LB tokens from wallet'
          },
          {
            key: 'ADD_LIQUIDITY',
            name: 'Add liquidity',
            disabled: !this.hasSmartLoanContract || this.inProcess,
            disabledInfo: 'To create LP token, you need to add some funds from you wallet first'
          },
        ]
      }
    },
    setupRemoveActionsConfiguration() {
      this.removeActionsConfig =   {
        iconSrc: 'src/assets/icons/minus.svg',
        tooltip: 'Remove',
        menuOptions: [
          {
            key: 'WITHDRAW',
            name: 'Withdraw LB tokens to wallet',
            disabled: true && !this.hasSmartLoanContract //TODO: needs implementation
          },
          {
            key: 'REMOVE_LIQUIDITY',
            name: 'Remove Liquidity',
            disabled: !this.hasSmartLoanContract || this.inProcess || !this.hasBinsInPool
          },
        ]
      }
    },

    initAccount() {
      this.accountService.observeAccountLoaded().subscribe(account => {
        this.account = account;
        this.getUserBinsAndBalances();
      });
    },

    async getUserBinsAndBalances() {
      console.log('getUserBinsAndBalances')
      console.log('this.account: ', this.account)
      let result = await fetch(`https://corsproxy.io/?https://barn.traderjoexyz.com/v1/user/bin-ids/${this.account.toLowerCase()}/${config.chainSlug}/${this.lpToken.address.toLowerCase()}`);

      console.log(`https://corsproxy.io/?https://barn.traderjoexyz.com/v1/user/bin-ids/${this.account}/${config.chainSlug}/${this.lpToken.address}`)
      result = await result.text();
      if (/^[0-9\[\]\,]*$/.test(result)) {
        this.userBins = JSON.parse(result);
        const lbToken = new ethers.Contract(this.lpToken.address, LB_TOKEN.abi, provider.getSigner());

        this.userBalances = [];
        await Promise.all(
            this.userBins.map(async (id, i) => {
              return lbToken.balanceOf(this.account, id).then(
                  res => {
                    this.userBalances[i] = res;
                  }
              )
            })
        );
      }
      console.log(this.userBins)
      console.log(this.userBalances)
    },

    actionClick(key) {
      if (!this.inProcess && this.healthLoaded) {
        switch (key) {
          case 'ADD_FROM_WALLET':
            this.openAddTraderJoeV2FromWalletModal();
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

    async openAddTraderJoeV2FromWalletModal() {
      const modalInstance = this.openModal(AddTraderJoeV2FromWalletModal);
      modalInstance.userBins = this.userBins;
      modalInstance.userBalances = this.userBalances;
      modalInstance.lpToken = this.lpToken;

        modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        const fundLiquidityRequest = {
          ids: this.userBins,
          amounts: this.userBalances,
          pair: this.lpToken.address
        };

        this.handleTransaction(this.fundLiquidityTraderJoeV2Pool, {fundLiquidityRequest: fundLiquidityRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
          this.closeModal();
        });
      });
    },

    async openWithdrawTraderJoeV2Modal() {
      const modalInstance = this.openModal(WithdrawTraderJoeV2Modal);
      modalInstance.asset = this.lpToken;
      modalInstance.$on('WITHDRAW', withdrawEvent => {
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
          const addLiquidityInput = this.traderJoeService.getAddLiquidityParameters(
            this.account,
            this.tokenX,
            this.tokenY,
            parseUnits(addLiquidityEvent.tokenXAmount.toString(), this.firstAsset.decimals).toString(),
            parseUnits(addLiquidityEvent.tokenYAmount.toString(), this.secondAsset.decimals).toString(),
            addLiquidityEvent.distributionMethod,
            this.lpToken.binStep,
            this.activeId,
            addLiquidityEvent.binRange
          );
          const addLiquidityRequest = {
            symbol: this.lpToken.symbol,
            method: this.lpToken.addMethod,
            firstAsset: this.lpToken.primary,
            secondAsset: this.lpToken.secondary,
            firstAmount: addLiquidityEvent.tokenXAmount.toString(),
            secondAmount: addLiquidityEvent.tokenYAmount.toString(),
            addLiquidityInput,
          };

          // this.traderJoeService.addLiquidity({provider: this.provider, addLiquidityInput});

          this.handleTransaction(this.addLiquidityTraderJoeV2Pool, { addLiquidityRequest }, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
            this.closeModal();
          });
        }
      });
    },

    openRemoveLiquidityModal() {
      const modalInstance = this.openModal(TraderJoeRemoveLiquidityModal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.firstAsset = this.firstAsset;
      modalInstance.secondAsset = this.secondAsset;
      modalInstance.firstAssetBalance = this.assetBalances[this.lpToken.primary];
      modalInstance.secondAssetBalance = this.assetBalances[this.lpToken.secondary];
      modalInstance.activeId = this.activeId;
      modalInstance.binStep = this.lpToken.binStep;
      modalInstance.userBinIds = this.lpToken.userBinIds;
      modalInstance.$on('REMOVE_LIQUIDITY', async removeLiquidityEvent => {
        if (this.smartLoanContract) {
          const removeLiquidityInput = await this.traderJoeService.getRemoveLiquidityParameters(
            this.smartLoanContract.address,
            this.lpToken.address,
            this.provider,
            this.tokenX,
            this.tokenY,
            this.lpToken.binStep,
            removeLiquidityEvent.binRangeToRemove,
            this.lpToken.userBinIds
          );
          const removeLiquidityRequest = {
            symbol: this.lpToken.symbol,
            lbPairAddress: this.lpToken.address,
            method: this.lpToken.removeMethod,
            firstAsset: this.lpToken.primary,
            secondAsset: this.lpToken.secondary,
            remainingBinRange: removeLiquidityEvent.remainingBinRange,
            removeLiquidityInput,
          };

          this.handleTransaction(this.removeLiquidityTraderJoeV2Pool, { removeLiquidityRequest }, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
            this.closeModal();
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

    async setupPool() {
      const tokenX = this.traderJoeService.initializeToken(this.firstAsset);
      const tokenY = this.traderJoeService.initializeToken(this.secondAsset);

      this.tokenX = tokenX;
      this.tokenY = tokenY;

      const [reserves, activeId] = await this
        .traderJoeService
        .getLBPairReservesAndActiveBin(this.lpToken.address, this.provider);

      const tokenXTVL = formatUnits(reserves[0], this.firstAsset.decimals) * this.firstAsset.price;
      const tokenYTVL = formatUnits(reserves[1], this.secondAsset.decimals) * this.secondAsset.price;

      this.lpToken.tvl = tokenXTVL + tokenYTVL;
      this.activeId = activeId;
      this.hasBinsInPool = this.lpToken.userBinIds && this.lpToken.userBinIds.length > 0;
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
    grid-template-columns: 153px 150px 120px 200px 140px repeat(2, 1fr) 35px 80px;
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
