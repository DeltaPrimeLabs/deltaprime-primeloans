<template>
  <div id="modal" class="confirm-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        {{ title }}
      </div>
      <div class="modal-top-desc">
        <div v-if="content" class="modal-content">
          <span v-html="content"></span>
        </div>
      </div>

      <div class="button-wrapper">
        <Button :label="'Confirm'"
                v-on:click="submit()"
                :disabled="disabled"
                :waiting="inProgress">
        </Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from "./Modal.vue";
import Button from "./Button.vue";

export default {
  name: 'ConfirmModal',
  components: {
    Button,
    Modal,
  },
  props: {
    title: null,
    content: null,
    disabled: null,
    inProgress: null,
  },
  methods: {
    close() {
      this.closeModal();
    },
    submit() {
      this.inProgress = true;
      this.$emit('CONFIRM');
    },
  },
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

  a:hover {
    text-decoration: underline;
  }
}
</style>
