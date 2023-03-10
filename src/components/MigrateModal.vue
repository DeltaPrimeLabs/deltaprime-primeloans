<template>
  <div id="modal" class="migrate-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Migrate to auto-compounding vault
      </div>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Migrating {{ tokenSymbol }} from {{protocol}}:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div class="summary__value__pair">
              <div class="summary__label">
                Farmed:
              </div>
              <div class="summary__value">
                {{farmBalance | smartRound(10, true)}}
              </div>
            </div>
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                Rewards:
              </div>
              <div class="summary__value">
                {{ rewards | smartRound(10, true) }}
              </div>
            </div>

            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                Total amount:
              </div>
              <div class="summary__value">
                {{ Number(farmBalance) + Number(rewards) | smartRound(10, true) }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Migrate'"
                v-on:click="submit()"
                :waiting="transactionOngoing">
        </Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Button from './Button';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import Modal from './Modal';

export default {
  name: 'MigrateModal',
  components: {
    Button,
    TransactionResultSummaryBeta,
    Modal,
  },
  props: {
    farmBalance: null,
    rewards: null,
    protocol: null,
    tokenSymbol: null
  },

  data() {
    return {
      transactionOngoing: false,
    };
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      this.$emit('MIGRATE', null);
    },
  }
}
</script>

<style scoped lang="scss">
@import "~@/styles/variables";
@import "~@/styles/modal";

.modal__title {
  font-size: 28px;
}

</style>