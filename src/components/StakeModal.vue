<template>
  <div id="modal" class="stake-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Stake
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{0.0235 | percent}}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Available:</div>
        <div class="top-info__value">124.39 <span class="top-info__currency">AVAX</span></div>
      </div>

      <CurrencyInput :symbol="'AVAX'"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            <div class="stake-protocol">
              <img class="stake-protocol__icon" src="src/assets/logo/yak.svg">
              <div class="stake-protocol__name">Yak protocol</div>
              ,
            </div>
            Values after confirmation:
          </div>
          <div class="summary__values">
            <div class="summary__label">
              Staked:
            </div>
            <div class="summary__value">
              42.25 <span class="currency">AVAX</span>
            </div>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Daily interest ≈
            </div>
            <div class="summary__value">
              73.12 <span class="currency">AVAX</span>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Stake'" v-on:click="submit()"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import CurrencyInput from './CurrencyInput';
import Button from './Button';

export default {
  name: 'StakeModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal
  },

  methods: {
    submit() {
      this.$emit('stake', 1);
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.summary__title {
  .stake-protocol {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-right: 5px;

    .stake-protocol__icon {
      height: 22px;
      width: 22px;
      border-radius: 50%;
      margin-right: 9px;
    }

    .stake-protocol__name {
      font-weight: 600;
      color: black;
    }
  }
}

</style>