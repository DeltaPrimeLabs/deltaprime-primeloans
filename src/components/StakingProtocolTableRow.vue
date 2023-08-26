<template>
  <div class="staking-farm-table-row-component" v-if="farm">

    <div class="protocol-banner" v-if="farm.protocolIdentifier === 'VF_USDC_MAIN'">Deposits and withdrawals from Platypus main pool have been
      temporarily disabled. Read more in our
      <a class="banner__link" href="https://discord.com/invite/9bwsnsHEzD" target="_blank">Discord</a>.
    </div>
    <div class="protocol-banner" v-if="farm.protocolIdentifier === 'YY_TJ_AVAX_sAVAX_LP'">
      Rewards for this farm have been turned off, removing compounding benefits. Therefore, depositing into this farm has been disabled.
    </div>

    <div class="table__row">
      <div class="table__cell farm-cell">
        <div class="farm">
          <img class="protocol__icon" :src="`src/assets/logo/${protocol.logo}`">
          <div class="protocol__details">
            <div class="asset-name">
              {{ asset.name }}
              <InfoIcon
                  class="info__icon"
                  v-if="farm.info"
                  :tooltip="{content: farm.info, classes: 'info-tooltip long', placement: 'right'}"
              ></InfoIcon>
            </div>
            <div class="by-farm">{{ protocol.name }} -> {{ farm.strategy }}</div>
          </div>
        </div>
      </div>

      <div class="table__cell">
        <div class="double-value staked-balance">
          <div class="double-value__pieces">
            <span v-if="isStakedBalanceEstimated">~</span>{{
              isLP ? formatTokenBalance(underlyingTokenStaked, 10, true) : formatTokenBalance(underlyingTokenStaked)
            }}
          </div>
          <div class="double-value__usd">{{ underlyingTokenStaked * asset.price | usd }}</div>
        </div>
      </div>

      <div class="table__cell rewards__cell">
        <div class="rewards__wrapper" v-if="!farm.autoCompounding">
          <div class="reward__icons">
            <img class="reward__asset__icon" v-if="farm.rewardTokens" v-for="token of farm.rewardTokens"
                 :src="logoSrc(token)">
          </div>
          <div class="double-value">
            <div class="double-value__pieces">
              {{ rewards | usd }}
            </div>
          </div>
          <InfoIcon
              class="info__icon"
              v-if="farm.rewardsInfo"
              :tooltip="{content: farm.rewardsInfo, classes: 'info-tooltip long', placement: 'right'}"
          ></InfoIcon>
        </div>
      </div>

      <div class="table__cell">
        {{ apy | percent }}
      </div>

      <div class="table__cell max-apy">
        {{ maxApy | percent }}
      </div>

      <div class="table__cell">
        <div class="actions">
          <FlatButton v-if="farm.migrateMethod" :tooltip="'Migrates assets from the manual pool to the autocompounding pool'" v-on:buttonClick="migrateButtonClick()">Migrate
          </FlatButton>
          <IconButtonMenuBeta
              class="actions__icon-button"
              :config="addActionsConfig"
              v-on:iconButtonClick="actionClick"
              :disabled="disableAllButtons || !healthLoaded">
          </IconButtonMenuBeta>
          <IconButtonMenuBeta
              class="actions__icon-button"
              :config="removeActionsConfig"
              v-on:iconButtonClick="actionClick"
              :disabled="disableAllButtons || !healthLoaded">
          </IconButtonMenuBeta>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import StakeModal from './StakeModal';
import UnstakeModal from './UnstakeModal';
import {mapState, mapActions} from 'vuex';
import config from '../config';
import {calculateMaxApy} from '../utils/calculate';
import IconButtonMenuBeta from './IconButtonMenuBeta';
import FlatButton from './FlatButton';
import MigrateModal from './MigrateModal';
import InfoIcon from "./InfoIcon.vue";
import AddFromWalletModal from "./AddFromWalletModal.vue";
import erc20ABI from "../../test/abis/ERC20.json";
import WithdrawModal from "./WithdrawModal.vue";

const ethers = require('ethers');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'StakingProtocolTableRow',
  components: {InfoIcon, FlatButton, IconButtonMenuBeta},
  props: {
    farm: {
      required: true,
    },
    asset: {
      required: true,
    }
  },
  async mounted() {
    this.setupAddActionsConfiguration();
    this.setupRemoveActionsConfiguration();
    this.watchHardRefreshScheduledEvent();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchHealth();
    this.watchProgressBarState();
    this.watchFarmRefreshEvent();
    this.watchExternalStakedPerFarm();
  },
  data() {
    return {
      receiptTokenBalance: 0,
      underlyingTokenStaked: 0,
      apy: 0,
      maxApy: 0,
      rewards: 0,
      isStakedBalanceEstimated: false,
      disableAllButtons: false,
      assetBalances: {},
      lpBalances: {},
      addActionsConfig: null,
      removeActionsConfig: null,
      healthLoaded: false,
    };
  },
  watch: {
    smartLoanContract: {
      async handler(smartLoanContract) {
        if (smartLoanContract) {
          this.$emit('stakedChange', this.underlyingTokenStaked);
        }
      },
      immediate: true
    },
    pools: {
      handler(pools) {
        this.maxApy = calculateMaxApy(this.pools, this.apy);
      }
    }
  },
  computed: {
    ...mapState('network', ['account']),
    ...mapState('poolStore', ['pools']),
    ...mapState('stakeStore', ['farms']),
    ...mapState('fundsStore', [
      'smartLoanContract',
      'fullLoanStatus',
      'debtsPerAsset',
      'assets',
      'lpAssets',
      'concentratedLpAssets',
      'concentratedLpBalances',
      'noSmartLoan'
    ]),
    ...mapState('serviceRegistry', [
      'assetBalancesExternalUpdateService',
      'stakedExternalUpdateService',
      'dataRefreshEventService',
      'progressBarService',
      'farmService',
      'healthService'
    ]),
    protocol() {
      return config.PROTOCOLS_CONFIG[this.farm.protocol];
    },
    disabled() {
      return !this.smartLoanContract || this.smartLoanContract.address === NULL_ADDRESS || this.disableAllButtons || !this.healthLoaded;
    },
    isLP() {
      return this.asset.secondary != null;
    }
  },
  methods: {
    ...mapActions('stakeStore', ['fund','withdraw', 'stake', 'unstake', 'migrateToAutoCompoundingPool']),

    actionClick(key) {
      switch (key) {
        case 'ADD_FROM_WALLET':
          this.openAddFromWalletModal();
          break;
        case 'STAKE':
          this.openStakeModal();
          break;
        case 'WITHDRAW':
          this.openWithdrawModal();
          break;
        case 'UNSTAKE':
          this.openUnstakeModal();
          break;
      }
    },

    async openAddFromWalletModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      modalInstance.asset = this.farm;
      modalInstance.assetBalance = this.balance ? this.balance : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.loan = this.debt;
      modalInstance.thresholdWeightedValue = this.thresholdWeightedValue;
      modalInstance.isLP = false;
      modalInstance.isFarm = true;
      modalInstance.logo = this.protocol.logo;
      modalInstance.walletAssetBalance = await this.getWalletAssetBalance();

      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
          const fundRequest = {
            value: addFromWalletEvent.value.toString(),
            farmSymbol: this.farm.feedSymbol,
            farmDecimals: this.farm.decimals,
            receiptTokenAddress: this.farm.receiptTokenAddress ? this.farm.receiptTokenAddress : this.farm.stakingContractAddress,
            assetSymbol: this.asset.symbol,
            protocolIdentifier: this.farm.protocolIdentifier,
            type: 'FARM',
          };
          this.handleTransaction(this.fund, {fundRequest: fundRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    async openWithdrawModal() {
      const modalInstance = this.openModal(WithdrawModal);
      modalInstance.asset = this.farm;
      modalInstance.assetBalance = this.balance ? this.balance : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.loan = this.debt;
      modalInstance.thresholdWeightedValue = this.thresholdWeightedValue;
      modalInstance.isLP = false;
      modalInstance.isFarm = true;
      modalInstance.logo = this.protocol.logo;
      modalInstance.walletAssetBalance = await this.getWalletAssetBalance();

      modalInstance.$on('WITHDRAW', withdrawEvent => {
        if (this.smartLoanContract) {
          const withdrawRequest = {
            value: withdrawEvent.value.toString(),
            farmSymbol: this.farm.feedSymbol,
            farmDecimals: this.farm.decimals,
            receiptTokenAddress: this.farm.receiptTokenAddress ? this.farm.receiptTokenAddress : this.farm.stakingContractAddress,
            assetSymbol: this.asset.symbol,
            protocolIdentifier: this.farm.protocolIdentifier,
            type: 'FARM',
          };
          this.handleTransaction(this.withdraw, {withdrawRequest: withdrawRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    async openStakeModal() {
      if (this.disabled) {
        return;
      }

      const modalInstance = this.openModal(StakeModal);
      modalInstance.apy = this.apy;
      modalInstance.available = this.asset.secondary ? this.lpBalances[this.asset.symbol] : this.assetBalances[this.asset.symbol];
      modalInstance.underlyingTokenStaked = this.underlyingTokenStaked;
      modalInstance.rewards = this.rewards;
      modalInstance.asset = this.asset;
      modalInstance.protocol = this.protocol;
      modalInstance.isLP = this.isLP;
      modalInstance.$on('STAKE', (stakeValue) => {
        const stakeRequest = {
          feedSymbol: this.farm.feedSymbol,
          assetSymbol: this.asset.symbol,
          protocol: this.farm.protocol,
          protocolIdentifier: this.farm.protocolIdentifier,
          amount: stakeValue.toString(),
          method: this.farm.stakeMethod,
          decimals: this.asset.decimals,
          gas: this.farm.gasStake,
          refreshDelay: this.farm.refreshDelay ? this.farm.refreshDelay : 30000,
          isLP: this.isLP,
        };
        this.handleTransaction(this.stake, {stakeRequest: stakeRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        });
      });
    },

    openUnstakeModal() {
      if (this.disabled) {
        return;
      }

      const modalInstance = this.openModal(UnstakeModal);
      modalInstance.apy = this.apy;
      modalInstance.staked = this.underlyingTokenStaked;
      modalInstance.asset = this.asset;
      modalInstance.receiptTokenBalance = this.farm.totalBalance;
      modalInstance.protocol = this.protocol;
      modalInstance.isLP = this.isLP;
      modalInstance.$on('UNSTAKE', unstakeEvent => {
        const unstakeRequest = {
          receiptTokenUnstaked: unstakeEvent.receiptTokenUnstaked.toString(),
          minReceiptTokenUnstaked: this.farm.minAmount * parseFloat(unstakeEvent.receiptTokenUnstaked),
          underlyingTokenUnstaked: unstakeEvent.underlyingTokenUnstaked.toString(),
          assetSymbol: this.asset.symbol,
          feedSymbol: this.farm.feedSymbol,
          protocol: this.farm.protocol,
          protocolIdentifier: this.farm.protocolIdentifier,
          method: this.farm.unstakeMethod,
          decimals: this.asset.decimals,
          gas: this.farm.gasUnstake,
          rewardTokens: this.farm.rewardTokens ? this.farm.rewardTokens : [],
          refreshDelay: this.farm.refreshDelay ? this.farm.refreshDelay : 30000,
          isLP: this.isLP,
          isMax: unstakeEvent.isMax
        };
        this.handleTransaction(this.unstake, {unstakeRequest: unstakeRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        });
      });
    },

    watchHardRefreshScheduledEvent() {
      this.dataRefreshEventService.hardRefreshScheduledEvent$.subscribe(() => {
        this.disableAllButtons = true;
        this.$forceUpdate();
      });
    },

    watchHealth() {
      this.healthService.observeHealth().subscribe(health => {
        this.healthLoaded = true;
      });
    },

    watchAssetBalancesDataRefreshEvent() {
      this.dataRefreshEventService.assetBalancesDataRefreshEvent$.subscribe((refreshEvent) => {
        this.assetBalances = refreshEvent.assetBalances;
        this.lpBalances = refreshEvent.lpBalances;
        this.disableAllButtons = false;
        this.$forceUpdate();
      });
    },

    watchFarmRefreshEvent() {
      this.farmService.observeRefreshFarm().subscribe(async () => {
        // receipt token staked
        this.balance = this.farm.totalBalance;
        // normal token staked
        this.underlyingTokenStaked = this.farm.totalStaked;
        this.rewards = this.farm.rewards;
        this.setApy();
      });
    },

    watchExternalStakedPerFarm() {
      this.stakedExternalUpdateService.observeExternalStakedBalancesPerFarmUpdate().subscribe(stakedBalancesPerFarmUpdate => {
        if (this.farm.protocolIdentifier === stakedBalancesPerFarmUpdate.protocolIdentifier) {
          this.receiptTokenBalance = stakedBalancesPerFarmUpdate.receiptTokenBalance;
          this.farm.totalBalance = stakedBalancesPerFarmUpdate.receiptTokenBalance;
          this.underlyingTokenStaked = stakedBalancesPerFarmUpdate.stakedBalance;
          this.farm.totalStaked = stakedBalancesPerFarmUpdate.stakedBalance;
        }
        this.$forceUpdate();
      });
    },

    setApy() {
      if (!this.farm.currentApy) return 0;

      let assetApy = this.asset.apy && this.asset.symbol !== 'GLP' ? this.asset.apy / 100 : 0;


      this.apy = this.isLp ? (1 + this.farm.currentApy + assetApy) - 1 : (1 + this.farm.currentApy) * (1 + assetApy) - 1;

      if (this.pools) {
        this.maxApy = calculateMaxApy(this.pools, this.apy);
      }
    },

    scheduleHardRefresh() {
      this.progressBarService.emitProgressBarInProgressState();
      this.dataRefreshEventService.emitHardRefreshScheduledEvent();
    },

    watchProgressBarState() {
      this.progressBarService.progressBarState$.subscribe((state) => {
        switch (state) {
          case 'MINING' : {
            this.disableAllButtons = true;
            break;
          }
          case 'SUCCESS': {
            this.disableAllButtons = false;
            break;
          }
          case 'ERROR' : {
            this.isStakedBalanceEstimated = false;
            this.disableAllButtons = false;
            break;
          }
          case 'CANCELLED' : {
            this.isStakedBalanceEstimated = false;
            this.disableAllButtons = false;
            break;
          }
        }
      });
    },

    handleTransactionError(error) {
      if (error.code === 4001 || error.code === -32603) {
        this.progressBarService.emitProgressBarCancelledState();
      } else {
        this.progressBarService.emitProgressBarErrorState();
      }
      this.closeModal();
      this.disableAllButtons = false;
      this.isStakedBalanceEstimated = false;
    },
    setupAddActionsConfiguration() {
      this.addActionsConfig =   {
        iconSrc: 'src/assets/icons/plus.svg',
        tooltip: 'Add',
        menuOptions: [
          {
            key: 'ADD_FROM_WALLET',
            name: 'Add from wallet',
            disabled: !this.farm.feedSymbol,
            disabledInfo: 'Coming soon'
          },
          {
            key: 'STAKE',
            name: 'Stake into vault',
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
            name: 'Withdraw to wallet',
            disabled: !this.farm.feedSymbol,
            disabledInfo: 'Coming soon'
          },
          {
            key: 'UNSTAKE',
            name: 'Unstake from vault',
          },
        ]
      }
    },

    async getWalletAssetBalance() {
      const tokenContract = new ethers.Contract(this.farm.receiptTokenAddress ? this.farm.receiptTokenAddress : this.farm.stakingContractAddress, erc20ABI, this.provider.getSigner());
      return await this.getWalletTokenBalance(this.account, this.asset.symbol, tokenContract, this.farm.decimals);
    },

    migrateButtonClick() {
      const modalInstance = this.openModal(MigrateModal);
      modalInstance.protocol = this.protocol.name;
      modalInstance.rewards = this.rewards;
      modalInstance.farmBalance = this.underlyingTokenStaked;
      modalInstance.tokenSymbol = this.farm.token;

      const migrateRequest = {
        migrateMethod: this.farm.migrateMethod,
        decimals: config.ASSETS_CONFIG[this.asset.symbol].decimals,
        assetSymbol: this.asset.symbol,
        protocolIdentifier: this.farm.protocolIdentifier
      };

      modalInstance.$on('MIGRATE', () => {
        this.handleTransaction(this.migrateToAutoCompoundingPool, {migrateRequest: migrateRequest}, () => {
          this.rewards = 0;
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        });
      });
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.staking-farm-table-row-component {
  border-style: solid;
  border-width: 2px 0 0 0;
  border-image-source: var(--staking-protocol-table-row__border);
  border-image-slice: 1;

  .protocol-banner {
    color: $orange;
    font-weight: 500;
    font-size: $font-size-xxs;
    margin-top: 5px;
    margin-bottom: -10px;

    .banner__link {
      color: $orange;
      font-weight: 600;
    }
  }

  .table__row {
    display: grid;
    grid-template-columns: 23% 1fr 170px 170px 160px 190px 22px;
    height: 60px;
    padding: 0 6px;

    .table__cell {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      font-weight: 500;
      font-size: $font-size-xsm;

      &.farm-cell {
        justify-content: flex-start;
      }

      &.rewards__cell {

        .rewards__wrapper {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-end;

          .info__icon {
            margin-left: 5px;
          }
        }
      }

      .farm {
        display: flex;
        flex-direction: row;
        align-items: center;

        .protocol__icon {
          opacity: var(--staking-protocol-table-row__protocol-icon-opacity);
          height: 22px;
          width: 22px;
          border-radius: 50%;
        }

        .protocol__details {
          display: flex;
          flex-direction: column;
          margin-left: 10px;

          .asset__name {
            font-size: $font-size-xsm;
            font-weight: 500;
          }

          .info__icon {
            transform: translateY(-2px);
          }

          .by-farm {
            font-size: $font-size-xxs;
            font-weight: 500;
            color: var(--staking-protocol-table-row__secondary-text-color);
            margin-top: -2px;
          }
        }
      }

      .double-value {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        text-align: end;

        .double-value__pieces {
          font-weight: 500;
          font-size: $font-size-xsm;
        }

        &.balance-balance {
          .double-value__pieces {
            font-weight: 600;
          }
        }

        .double-value__usd {
          font-size: $font-size-xxs;
          color: var(--staking-protocol-table-row__secondary-text-color);
        }
      }

      &.max-apy {
        font-weight: 600;
      }

      .reward__icons {
        .reward__asset__icon {
          margin-right: 5px;
          width: 20px;
          height: 20px;
        }
      }

      .actions {
        display: flex;
        flex-direction: row;
        align-items: center;

        .action {
          width: 26px;
          height: 26px;
          cursor: pointer;

          &:not(:last-child) {
            margin-right: 12px;
          }

          &.disabled {
            opacity: 0.5;
            cursor: default;
          }
        }
      }
    }
  }
}
</style>
<style lang="scss">
.tooltip {
  max-width: none;
  width: auto;
}
</style>
