<template>
  <div id="modal" class="claim-level-rewards-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Claim Level rewards
      </div>

      <div class="modal-top-desc">
        <div class="rewards-info">
          Rewards will be sent to your personal wallet.
          <br/>
          You can go to the
          <a href="https://app.level.finance/vesting/normal" target="_blank"><b>Level&nbsp;website</b></a>
            to vest them.
        </div>
      </div>

      <div class="rewards">
        <span class="rewards__label">Rewards to claim:</span>
        <span class="rewards__value">
          {{ rewardsToClaim | smartRound(10, true) }} {{ levelRewardsAsset }}
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
  name: 'ClaimLevelRewardsModal',
  components: {
    Button,
    TransactionResultSummaryBeta,
    Modal,
  },

  props: {
    assetBalances: {},
    rewardsToClaim: {},
    levelRewardsAsset: {}
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

.claim-level-rewards-modal-component {

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
    }
  }
}

</style>