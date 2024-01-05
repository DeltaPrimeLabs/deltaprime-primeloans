<template>
  <div id="modal" class="claim-balancer-rewards-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Claim Balancer rewards
      </div>

      <div class="modal-top-desc">
        <div class="rewards-info">
          Rewards will be sent to your personal wallet.
        </div>
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
    assetBalances: {},
    totalRewards: {}
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

.claim-balancer-rewards-modal-component {

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