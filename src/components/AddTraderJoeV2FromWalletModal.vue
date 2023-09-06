<template>
  <div v-if="lpToken" id="modal" class="add-from-wallet-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Add LB tokens from wallet
      </div>
      <div class="modal-top-desc">
        <div v-if="userBalances && userBalances.length > 0">
          This action will transfer your {{ lpToken.name}} LB tokens to your Prime Account.
          <br>
          Refresh the site after transaction to see the transferred tokens.
        </div>
        <div v-else>
          Currently you have no LB tokens in your wallet, but you can create them with the <b>Add liquidity</b> action!
        </div>
      </div>

      <div class="button-wrapper">
        <Button :label="'Add LB tokens'"
                v-on:click="submit()"
                :disabled="!userBalances || userBalances.length === 0"
                :waiting="transactionOngoing">
        </Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import DeltaIcon from "./DeltaIcon.vue";
import Toggle from "./Toggle.vue";
import CurrencyInput from "./CurrencyInput.vue";
import LoadedValue from "./LoadedValue.vue";
import Modal from "./Modal.vue";
import TransactionResultSummaryBeta from "./TransactionResultSummaryBeta.vue";
import BarGaugeBeta from "./BarGaugeBeta.vue";
import Button from "./Button.vue";

export default {
  name: 'AddTraderJoeV2FromWalletModal',
  components: {Button, BarGaugeBeta, TransactionResultSummaryBeta, Modal, LoadedValue, CurrencyInput, Toggle, DeltaIcon},
  props: {
    lpToken: {},
    userBins: [],
    userBalances: [],
    transactionOngoing: false
  },
  methods: {
    close() {
      this.closeModal();
    },
    submit() {
      this.transactionOngoing = true;
        this.$emit('ADD_FROM_WALLET');
      }
    }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";
</style>

<style lang="scss" scoped>

.modal-component {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;

  .modal-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;

    .backdrop {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      height: 100%;
      -webkit-backdrop-filter: var(--modal__backdrop-backdrop-filter);
      backdrop-filter: var(--modal__backdrop-backdrop-filter);
      background-color: var(--modal__backdrop-background);

      .modal {
        position: absolute;
        width: 750px;
        border-radius: 21px;
        background-color: var(--modal__background-color);
        padding: 60px 0;

        &::after {
          position: absolute;
          top: -4px;
          bottom: -4px;
          left: -4px;
          right: -4px;
          background-image: var(--modal__border);
          box-shadow: var(--modal__box-shadow);
          content: '';
          z-index: -1;
          border-radius: 25px;
        }
      }

      .close-button-container {
        position: absolute;
        top: 16px;
        right: 16px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;

        .close-button-container__icon {
          background: var(--modal__close-button-container-color);
          cursor: pointer;
        }
      }

      .modal-scroll {
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0 100px;
        line-height: normal;

        &::-webkit-scrollbar {
          width: 12px;
        }

        &::-webkit-scrollbar-thumb {
          border: 4px solid transparent;
          background-clip: padding-box;
          background-color: var(--modal__scroll-bar-background);
          border-radius: 999px;

          &:hover {
            background-color: var(--modal__scroll-bar-hover-background);
          }
        }
      }
    }
  }
}

.modal-top-desc {
  text-align: center;
}
</style>
