<template>
  <div id="modal" class="claim-traderjoe-rewards-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Import Balancer LP tokens
      </div>

      <div class="modal-top-desc">
        <div class="rewards-info">
          Your Balancer position will be imported to your Prime Account. If you don't see your BPT tokens here, please unstake them first from Balancer gauge.
        </div>
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{walletAssetBalance | smartRound(10, true)}}</div>
        <span class="top-info__currency">
          BPT
        </span>
      </div>

      <div class="button-wrapper">
        <Button :label="'IMPORT'" v-on:click="submit()"
                :disabled="!walletAssetBalance || parseFloat(walletAssetBalance) === 0"
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
  name: 'FundAndStakeBalancerModal',
  components: {
    Button,
    TransactionResultSummaryBeta,
    Modal,
  },

  props: {
    walletAssetBalance: 0
  },

  data() {
    return {
      transactionOngoing: false,
    };
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      this.$emit('FUND_AND_STAKE', true);
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.claim-traderjoe-rewards-modal-component {

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