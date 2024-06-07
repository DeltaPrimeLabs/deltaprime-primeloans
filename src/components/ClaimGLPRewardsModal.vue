<template>
  <div id="modal" class="claim-glp-rewards-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Claim GLP rewards
      </div>

      <div class="rewards">
        <span class="rewards__label">Rewards to claim:</span>
        <span class="rewards__value">
          {{ glpRewardsToClaim | smartRound(10, true) }} {{ glpRewardsAsset }}
        </span>
      </div>


      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div>
              <div class="summary__label">
                Balance:
              </div>
              <div class="summary__value" v-if="assetBalances && glpRewardsAsset">
                {{ Number(assetBalances[glpRewardsAsset]) + Number(glpRewardsToClaim) | smartRound }}
                {{ glpRewardsAsset }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
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
  name: 'ClaimGLPRewardsModal',
  components: {
    Button,
    TransactionResultSummaryBeta,
    Modal,
  },

  props: {
    assetBalances: {},
    glpRewardsToClaim: {},
    glpRewardsAsset: {}
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

.claim-glp-rewards-modal-component {
  .rewards {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    color: var(--claim-glp-modal__rewards-label-color);

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