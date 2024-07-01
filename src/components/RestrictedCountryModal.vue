<template>
  <div id="modal" class="restricted-country-modal-component modal-component">
    <Modal :closable="allowWithdrawals">
      <div class="modal__title">
        Attention
      </div>

      <div class="modal__content">
        <div class="content__part content__part--first">
          We have detected that you are currently located in an area where our services are unavailable due to regulatory restrictions on blockchain and cryptocurrency activities.
        </div>
      </div>

      <div v-if="allowWithdrawals" class="content__part">
        You can withdraw your funds by clicking the button below.
      </div>

      <div class="content__part">
        If you have any questions or need assistance, please contact our support team at contact@deltaprime.com.
      </div>

      <div v-if="allowWithdrawals" class="button-wrapper">
        <Button :label="'Withdraw'" :waiting="buttonWaiting" v-on:click="close()"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import Button from './Button';

export default {
  name: 'TermsModal',
  components: {
    Button,
    Modal,
  },

  props: {
    allowWithdrawals: {
      type: Boolean,
      default: null
    }
  },

  data() {
    return {
      buttonWaiting: false
    }
  },

  mounted() {

  },

  computed: {
  },

  methods: {
    close() {
      this.closeModal();
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.restricted-country-modal-component {

  .modal__title {
    margin-bottom: 40px;
  }

  .modal__content {
    text-align: justify;
  }

  .terms-link {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    margin-top: 20px;
    color: var(--default-text-color);
    font-weight: 600;
    font-size: $font-size-md;

    &:hover {
      text-decoration: underline;
      cursor: pointer;
    }
  }

  .content__part {
    &:not(:first-child) {
      margin-top: 20px;
    }

    &.content__part--first {
      font-weight: 600;
      line-height: 1.4;
    }

    &.content__part--last {
      text-align: end;
    }
  }
}

</style>