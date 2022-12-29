<template>
  <div class="staking-farm-table-row-component" v-if="farm">
    <div class="table__row">
      <div class="table__cell farm-cell">
        <div class="farm">
          <img class="protocol__icon" :src="`src/assets/logo/${protocol.logo}`">
          <div class="protocol__details">
            <div class="asset-name">
              {{ asset.name }}
              <img v-if="farm.info"
                   class="info__icon"
                   src="src/assets/icons/info.svg"
                   v-tooltip="{content: farm.info, classes: 'info-tooltip long'}">
            </div>
            <div class="by-farm">{{ protocol.name }} -> {{ farm.strategy }}</div>
          </div>
        </div>
      </div>

      <div class="table__cell">
        <div class="double-value staked-balance">
          <div class="double-value__pieces">
            <span v-if="isStakedBalanceEstimated">~</span>{{ isLP ? formatTokenBalance(balance, 10, true) : formatTokenBalance(balance) }}
          </div>
          <div class="double-value__usd">{{ balance * asset.price | usd }}</div>
        </div>
      </div>

      <div class="table__cell">
        <div class="reward__icons">
          <img class="reward__asset__icon" v-if="farm.rewardTokens" v-for="token of farm.rewardTokens" :src="logoSrc(token)">
        </div>
        <div class="double-value">
          <div class="double-value__pieces">
            {{ rewards | usd }}
          </div>
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
          <img class="action" v-bind:class="{'disabled': disabled}" src="src/assets/icons/plus.svg"
               v-on:click="openStakeModal()">
          <img class="action" v-bind:class="{'disabled': disabled}" src="src/assets/icons/minus.svg"
               v-on:click="openUnstakeModal()">
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
import {calculateMaxApy} from "../utils/calculate";

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'StakingProtocolTableRow',
  props: {
    farm: {
      required: true,
    },
    asset: {
      required: true,
    }
  },
  async mounted() {
    this.watchHardRefreshScheduledEvent();
    this.apy = await this.farm.apy();
  },
  data() {
    return {
      balance: 0,
      apy: 0,
      rewards: 0,
      isStakedBalanceEstimated: false,
      waitingForHardRefresh: false,
    };
  },
  watch: {
    smartLoanContract: {
      async handler(smartLoanContract) {
        if (smartLoanContract) {
          this.balance = await this.farm.staked(this.smartLoanContract.address);
          this.rewards = await this.farm.rewards(this.smartLoanContract.address);
          this.$emit('stakedChange', this.balance);
        }
      },
      immediate: true
    },
  },
  computed: {
    ...mapState('poolStore', ['pools']),
    ...mapState('stakeStore', ['stakedAssets']),
    ...mapState('fundsStore', ['assetBalances', 'lpBalances', 'smartLoanContract']),
    ...mapState('serviceRegistry', ['assetBalancesExternalUpdateService', 'totalStakedExternalUpdateService', 'dataRefreshEventService']),
    maxApy() {
      return calculateMaxApy(this.pools, this.apy);
    },
    protocol() {
      return config.PROTOCOLS_CONFIG[this.farm.protocol];
    },
    disabled() {
      return !this.smartLoanContract || this.smartLoanContract.address === NULL_ADDRESS || this.waitingForHardRefresh;
    },
    isLP() {
      return this.asset.secondary != null;
    }
  },
  methods: {
    ...mapActions('stakeStore', ['stake', 'unstake']),
    async openStakeModal() {
      if (this.disabled) {
        return;
      }

      const modalInstance = this.openModal(StakeModal);
      modalInstance.apy = this.apy;
      modalInstance.available = this.asset.secondary ? this.lpBalances[this.asset.symbol] : this.assetBalances[this.asset.symbol];
      modalInstance.staked = this.balance;
      modalInstance.rewards = this.rewards;
      modalInstance.asset = this.asset;
      modalInstance.protocol = this.protocol;
      modalInstance.isLP = this.isLP;
      modalInstance.$on('STAKE', (stakeValue) => {
        const stakeRequest = {
          symbol: this.farm.feedSymbol,
          amount: stakeValue.toString(),
          method: this.farm.stakeMethod,
          decimals: this.asset.decimals
        };
        this.handleTransaction(this.stake, {stakeRequest: stakeRequest}, () => {
          this.balance = Number(this.balance) + Number(stakeRequest.amount);
          this.isStakedBalanceEstimated = true;
          const assetBalance = this.isLP ? this.lpBalances[this.asset.symbol] : this.assetBalances[this.asset.symbol];
          const assetBalanceAfterTransaction = Number(assetBalance) - Number(stakeRequest.amount);
          this.assetBalancesExternalUpdateService.emitExternalAssetBalanceUpdate(this.asset.symbol, assetBalanceAfterTransaction, this.isLP);
          this.totalStakedExternalUpdateService.emitExternalTotalStakedUpdate(this.asset.symbol, stakeRequest.amount, 'STAKE');
          this.dataRefreshEventService.emitHardRefreshScheduledEvent();
          this.$forceUpdate();
        }, () => {
        }).then(() => {
          this.closeModal();
          setTimeout(() => {
            this.farm.staked(this.smartLoanContract.address).then((balance) => {
              this.balance = balance;
              this.isStakedBalanceEstimated = false;
              this.waitingForHardRefresh = false;
              this.$emit('balanceChange', this.balance);
            });
          }, 30000);
        });
      });
    },

    openUnstakeModal() {
      if (this.disabled) {
        return;
      }

      const modalInstance = this.openModal(UnstakeModal);
      modalInstance.apy = this.apy;
      modalInstance.balance = this.balance;
      modalInstance.asset = this.asset;
      modalInstance.protocol = this.protocol;
      modalInstance.isLP = this.isLP;
      modalInstance.$on('UNSTAKE', (unstakeValue) => {
        const unstakeRequest = {
          amount: unstakeValue.toString(),
          minAmount: this.farm.minAmount * unstakeValue,
          method: this.farm.unstakeMethod,
          decimals: this.asset.decimals
        };
        this.handleTransaction(this.unstake, {unstakeRequest: unstakeRequest}, () => {
          this.balance = Number(this.balance) - Number(unstakeRequest.amount);
          this.isStakedBalanceEstimated = true;
          const assetBalance = this.isLP ? this.lpBalances[this.asset.symbol] : this.assetBalances[this.asset.symbol];
          const assetBalanceAfterTransaction = Number(assetBalance) + Number(unstakeRequest.amount);
          this.assetBalancesExternalUpdateService.emitExternalAssetBalanceUpdate(this.asset.symbol, assetBalanceAfterTransaction, this.isLP);
          this.totalStakedExternalUpdateService.emitExternalTotalStakedUpdate(this.asset.symbol, unstakeRequest.amount, 'UNSTAKE');
          this.dataRefreshEventService.emitHardRefreshScheduledEvent();
          this.$forceUpdate();
        }, () => {
        }).then(result => {
          this.closeModal();
          setTimeout(() => {
            this.farm.staked(this.smartLoanContract.address).then((balance) => {
              this.balance = balance;
              this.isStakedBalanceEstimated = false;
              this.waitingForHardRefresh = false;
              this.$emit('stakedChange', this.balance);
            });
          }, 30000);
        });
      });
    },

    watchHardRefreshScheduledEvent() {
      this.dataRefreshEventService.hardRefreshScheduledEvent$.subscribe(() => {
        this.waitingForHardRefresh = true;
        this.$forceUpdate();
      })
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.staking-farm-table-row-component {

  .table__row {
    display: grid;
    grid-template-columns: 23% 1fr 170px 170px 160px 156px 22px;
    height: 60px;
    border-style: solid;
    border-width: 2px 0 0 0;
    border-image-source: linear-gradient(to right, #dfe0ff 43%, #ffe1c2 62%, #ffd3e0 79%);
    border-image-slice: 1;
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

      .farm {
        display: flex;
        flex-direction: row;
        align-items: center;

        .protocol__icon {
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
            color: $medium-gray;
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
          color: $medium-gray;
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