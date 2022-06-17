<template>
  <div id="modal" class="borrow-modal-component">
    <Modal>
      <div class="modal__title">
        Borrow
      </div>

      <div class="pool-info">
        <div class="pool-info__label">APY:</div>
        <div class="pool-info__value">{{0.0235 | percent}}</div>
        <div class="pool-info__divider"></div>
        <div class="pool-info__label">Available in pool:</div>
        <div class="pool-info__value">89284423.39 <span class="pool-info__currency">AVAX</span></div>
      </div>

      <CurrencyInput :symbol="'ETH'"></CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta></TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Borrow'"></Button>
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
  name: 'BorrowModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.borrow-modal-component {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  .modal__title {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: $font-size-xxxl;
  }

  .pool-info {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    color: $steel-gray;
    margin-top: 36px;
    margin-bottom: 10px;

    .pool-info__label {
      margin-right: 5px;
    }

    .pool-info__value {
      font-weight: 600;
    }

    .pool-info__divider {
      width: 2px;
      height: 17px;
      background-color: $smoke-gray;
      margin: 0 10px;
    }

    .pool-info__currency {
      font-weight: 400;
    }

  }

  .transaction-summary-wrapper {
    margin-top: 30px;
  }

  .button-wrapper {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    margin-top: 48px;
  }
}

</style>