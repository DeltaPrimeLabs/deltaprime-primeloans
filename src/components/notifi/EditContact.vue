<template>
  <div class="edit-contact">
    <template v-if="!editMode">
      <div class="view-container">
        <div class="contact-box">
          <div class="notifi-modal__text-info contact-info">
            {{ emailInfo.emailAddress }}
          </div>
          <div
            v-if="!emailInfo.isConfirmed"
            class="contact-verify"
          >
            <a
              class="verify-link"
              @click="handleVerifyEmail"
            >
              Resend Link
            </a>
          </div>
        </div>

        <div class="contact-box">
          <div class="notifi-modal__text-info contact-info">
            {{ telegramInfo.telegramId }}
          </div>
          <div
            v-if="telegramInfo.isConfirmed"
            class="link-text contact-verify"
          >
            <a
              class="verify-link"
              target="_blank"
              @click="handleVerifyTelegram()"
            >
              Verify ID
            </a>
          </div>
        </div>

        <div class="contact-box">
          <div class="notifi-modal__text-info contact-info">
            {{ phoneInfo.phoneNumber }}
          </div>
        </div>
      </div>

      <div
        class="link-text edit-button"
        @click="editMode = true"
      >
        <IconButton
          class="edit-icon"
          :icon-src="'src/assets/icons/icon_edit_xs.svg'"
          :size="12.7"
          @click="() => {}"
        ></IconButton>
        Edit contact info
      </div>
    </template>

    <div
      v-if="editMode"
      class="edit-container"
    >
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import IconButton from "../IconButton.vue";

export default ({
  name: 'Settings',
  components: {
    IconButton
  },
  props: {
    emailInfo: { type: Object, default: () => {} },
    phoneInfo: { type: Object, default: () => {} },
    telegramInfo: { type: Object, default: () => {} }
  },
  data() {
    return {
      editMode: false
    }
  },
  computed: {
    ...mapState('notifiStore', ['notifi']),
    ...mapState('serviceRegistry', ['notifiService'])
  },
  methods: {
    handleVerifyEmail() {
      this.notifiService.sendEmailTargetVerification(this.notifi.client, this.emailInfo.id);
    },

    handleVerifyTelegram() {
      window.open(this.telegramInfo.confirmationUrl, '_blank', 'noreferrer');
    }
  }
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/notifi";

.edit-contact {
  width: 100%;
  padding: 24px 30px;

  .view-container {
    border: var(--edit-contact__border);
    border-radius: 12px;
    background-color: var(--edit-contact__background-color);

    .contact-box {
      padding: 8px 14px;
      display: flex;
      justify-content: space-between;

      .contact-info {
        flex: auto;
        word-wrap: break-word;
        inline-size: 150px;
        font-size: $font-size-xs;
        color: var(--edit-contact__contact-info-color);
      }

      .contact-verify {
        display: flex;
        margin-left: 5px;

        .verify-link {
          line-height: normal;
        }
      }

      &:not(:first-child) {
        border-top: var(--edit-contact__contact-box-top-border);
      }
    }
  }

  .edit-button {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
    margin-right: 12px;
    text-align: right;

    .edit-icon {
      margin-right: 4px;
      transform: translateY(-1px);
    }
  }
}

.link-text {
  font-size: $font-size-xs;
  font-weight: 600;
  color: var(--edit-contact__contact-verify-color);
  cursor: pointer;
}

</style>