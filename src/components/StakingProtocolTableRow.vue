<template>
  <div class="staking-farm-table-row-component" v-if="farm">
    <div class="table__row">
      <div class="table__cell farm-cell">
        <div class="farm">
          <img class="protocol__icon" :src="`src/assets/logo/${protocol.logo}`">
          <div class="protocol__details">
            <div class="asset-name">{{ asset.name }}</div>
            <div class="by-farm">by {{ protocol.name }}</div>
          </div>
        </div>
      </div>

      <div class="table__cell">
        <div class="double-value staked-balance">
          <div class="double-value__pieces">{{ balance | smartRound }}</div>
          <div class="double-value__usd">{{ balance * asset.price | usd }}</div>
        </div>
      </div>

      <div class="table__cell">
        {{ apy | percent }}
      </div>

      <div class="table__cell">
        <div class="double-value">
          <div class="double-value__pieces">{{ calculateDailyInterest | smartRound }}</div>
          <div class="double-value__usd">{{ calculateDailyInterest * asset.price | usd }}</div>
        </div>
      </div>

      <div class="table__cell">
        <div class="double-value">
          <div class="double-value__pieces">0</div>
          <div class="double-value__usd">{{ 0 | usd }}</div>
        </div>
      </div>

      <div class="table__cell">
        <div class="actions">
          <img class="action" src="src/assets/icons/plus.svg" v-on:click="openStakeModal()">
          <img class="action" src="src/assets/icons/minus.svg" v-on:click="openUnstakeModal()">
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
    this.apy = await this.farm.apy();
  },
  data() {
    return {
      dailyInterest: 0,
      totalInterest: 0,
      balance: 0,
      apy: 0
    };
  },
  watch: {
    loan: {
      async handler(loan) {
        if (loan) {
          this.balance = await this.farm.staked(this.loan.address);
          this.$emit('balanceChange', this.balance);
        }
      },
      immediate: true
    },
  },
  computed: {
    ...mapState('stakeStore', ['stakedAssets']),
    ...mapState('loan', ['loan']),
    ...mapState('fundsStore', ['assetBalances']),
    calculateDailyInterest() {
      return this.apy / 365 * this.balance;
    },
    protocol() {
      return config.PROTOCOLS_CONFIG[this.farm.protocol];
    }
  },
  methods: {
    ...mapActions('stakeStore', ['stake', 'unstake']),
    openStakeModal() {
      const modalInstance = this.openModal(StakeModal);
      modalInstance.apy = this.apy;
      modalInstance.available = this.assetBalances[this.asset.symbol];
      modalInstance.staked = Number(this.balance);
      modalInstance.asset = this.asset;
      modalInstance.protocol = this.protocol;
      modalInstance.$on('STAKE', (stakeValue) => {
        const stakeRequest = {
          amount: stakeValue,
          method: this.farm.stakeMethod,
          decimals: this.asset.decimals
        };
        this.handleTransaction(this.stake, {stakeRequest: stakeRequest}).then(() => {
          this.closeModal();
          this.farm.staked(this.loan.address).then((balance) => {
            this.balance = balance;
            this.$emit('balanceChange', this.balance);
          });
        });
      });
    },

    openUnstakeModal() {
      const modalInstance = this.openModal(UnstakeModal);
      modalInstance.apy = this.apy;
      modalInstance.staked = Number(this.balance);
      modalInstance.asset = this.asset;
      modalInstance.protocol = this.protocol;
      modalInstance.$on('UNSTAKE', (unstakeValue) => {
        const unstakeRequest = {
          amount: unstakeValue,
          method: this.farm.unstakeMethod,
          decimals: this.asset.decimals
        };
        this.handleTransaction(this.unstake, {unstakeRequest: unstakeRequest}).then(result => {
          this.closeModal();
          this.farm.staked(this.loan.address).then((balance) => {
            this.balance = balance;
            this.$emit('balanceChange', this.balance);
          });
        });
      });
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.staking-farm-table-row-component {

  .table__row {
    display: grid;
    grid-template-columns: 20% repeat(5, 1fr);
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

        &.staked-balance {
          .double-value__pieces {
            font-weight: 600;
          }
        }

        .double-value__usd {
          font-size: $font-size-xxs;
          color: $medium-gray;
        }

        &.staked-balance {
          .double-value__pieces {

          }
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
        }
      }
    }
  }
}
</style>