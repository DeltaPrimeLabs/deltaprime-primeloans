<template>
  <div id="modal" class="borrow-modal-component">
    <Modal>
      <div class="modal__title">
        Borrow
      </div>

      <div class="modal-top-info">
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
        <Button :label="'Borrow'" v-on:click="borrowSubmit()"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
export default {
  name: 'RepayModal'
};
</script>

<style scoped>

</style>