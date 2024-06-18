<template>
  <div id="modal" class="claim-rewards-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        {{ header }}
      </div>

      <div class="modal-top-desc">
        <div class="rewards-info">
          Rewards will be sent to your personal wallet.
        </div>
      </div>

      <div class="rewards">
        <span class="rewards__label">Rewards to claim:</span>
        <span class="rewards__value">
          <div class="rewards__reward-token" v-for="reward in totalRewards">
            <img class="asset__icon" :src="getIcon(reward.symbol, tokensConfig[reward.symbol].logoExt)">
            {{ formatTokenBalanceWithLessThan(reward.amount, 8, true) }} {{ reward.symbol }}
          </div>
        </span>
      </div>

      <div class="button-wrapper">
        <Button :label="'Claim'" v-on:click="submit()"
                :waiting="transactionOngoing"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import Button from './Button';

export default {
  name: 'ClaimBalancerRewardsModal',
  components: {
    Button,
    TransactionResultSummaryBeta,
    Modal,
  },

  props: {
    totalRewards: {},
    header: {},
    tokensConfig: {},
  },

  data() {
    return {
      transactionOngoing: false,
    };
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      this.$emit('CLAIM', true);
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.claim-rewards-modal-component {

  .modal__title {
    margin-bottom: 40px;
  }

  .modal-top-desc {
    .rewards-info {
      text-align: center;
      line-height: 20px;
      margin-top: 15px;
    }
  }

  .rewards {
    margin-top: 40px;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    color: var(--modal__top-info-color);

    .rewards__label {
      font-weight: 400;
      margin-right: 5px;
    }

    .rewards__value {
      font-weight: 600;
      display: flex;

      .rewards__reward-token {
        text-align: center;

        &:not(:first-child) {
          margin-left: 15px;
        }

        .asset__icon {
          width: 20px;
          height: 20px;
          opacity: var(--asset-table-row__icon-opacity);
        }
      }
    }
  }
}

</style>
