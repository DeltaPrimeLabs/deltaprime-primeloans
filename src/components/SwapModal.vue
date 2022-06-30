<template>
  <div id="modal" class="swap-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Swap
      </div>

      <CurrencyComboInput></CurrencyComboInput>

      <div class="button-wrapper">
        <Button :label="'Borrow'" v-on:click="submit()"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import CurrencyInput from './CurrencyInput';
import Button from './Button';
import CurrencyComboInput from './CurrencyComboInput';

export default {
  name: 'SwapModal',
  components: {
    CurrencyComboInput,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
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