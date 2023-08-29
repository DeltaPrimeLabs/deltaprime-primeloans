<template>
  <div class="edit-contact">
    <template v-if="!editMode">
      <div class="view-container">
        <div v-if="contacts.emailInfo" class="contact-box">
          <div class="notifi-modal__text-info contact-info">
            {{ contacts.emailInfo.emailAddress }}
          </div>
          <div
            v-if="!contacts.emailInfo.isConfirmed"
            class="link-text contact-verify"
          >
            <a
              class="verify-link"
              @click.stop="handleVerifyEmail"
            >
              Resend Link
            </a>
          </div>
        </div>

        <div v-if="contacts.telegramInfo" class="contact-box">
          <div class="notifi-modal__text-info contact-info">
            {{ contacts.telegramInfo.telegramId }}
          </div>
          <div
            v-if="!contacts.telegramInfo.isConfirmed"
            class="link-text contact-verify"
          >
            <a
              class="verify-link"
              target="_blank"
              @click.stop="handleVerifyTelegram()"
            >
              Verify ID
            </a>
          </div>
        </div>
      </div>

      <div class="edit-button">
        <div
          class="link-text"
          @click.stop="editMode = true"
        >
          <IconButton
            class="edit-icon"
            :icon-src="'src/assets/icons/icon_edit_xs.svg'"
            :size="12.7"
          ></IconButton>
          Edit contact info
        </div>
      </div>
    </template>

    <div
      v-if="editMode"
      class="edit-container"
    >
      <DeltaIcon
        class="close-icon"
        :icon-src="'src/assets/icons/cross.svg'"
        :size="17"
        @click.stop.native="editMode = false"
      ></DeltaIcon>

      <div class="notifi-modal__text notifi-modal__text-info choose-text">
        Choose at least one destination
      </div>

      <FormInput
        :type="'email'"
        :placeholder="'Email'"
        :leftIconSrc="'src/assets/icons/icon_email.svg'"
        :noSpace="true"
        :defaultValue="contacts.emailInfo ? contacts.emailInfo.emailAddress : null"
        @valueChange="handleChange"
        :validators="emailValidators"
      ></FormInput>

      <FormInput
        :type="'telegram'"
        :placeholder="'Telegram ID'"
        :leftIconSrc="'src/assets/icons/icon_telegram.svg'"
        :noSpace="true"
        :defaultValue="contacts.telegramInfo ? contacts.telegramInfo.telegramId : null"
        @valueChange="handleChange"
      ></FormInput>

      <div class="save-button">
        <Button
          :label="'Save'"
          @click.stop.native="handleClick"
          :variant="'slim'"
          :disabled="isFormInvalid"
          :waiting="loading"
        ></Button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import IconButton from "../../IconButton.vue";
import DeltaIcon from '../../DeltaIcon.vue';
import FormInput from '../../FormInput.vue';
import Button from '../../Button.vue';
import config from '../../../config';

export default ({
  name: 'Settings',
  components: {
    IconButton,
    DeltaIcon,
    FormInput,
    Button
  },
  props: {
    emailInfo: null,
    telegramInfo: null,
    notifiClient: null
  },
  data() {
    return {
      editMode: false,
      targets: {
        emailAddress: this.emailInfo ? this.emailInfo.emailAddress : null,
        telegramId: this.telegramInfo ? this.telegramInfo.telegramId : null
      },
      contacts: {
        emailInfo: this.emailInfo,
        telegramInfo: this.telegramInfo
      },
      invalid: false,
      emailValidators: [],
      loading: false
    }
  },
  computed: {
    ...mapState('serviceRegistry', ['notifiService']),
    isFormInvalid() {
      return this.invalid || !this.targets.emailAddress && !this.targets.telegramId;
    }
  },
  mounted() {
    this.setupValidators();
  },
  methods: {
    setupValidators() {
      this.emailValidators = [
        {
          validate: (value) => {
            if (!config.EMAIL_REGEX.test(value)) {
              return 'Your email address is invalid';
            }
          }
        }
      ]
    },

    handleVerifyEmail() {
      this.notifiService.sendEmailTargetVerification(this.notifiClient, this.contacts.emailInfo.id);
    },

    handleVerifyTelegram() {
      window.open(this.contacts.telegramInfo.confirmationUrl, '_blank', 'noreferrer');
    },

    handleChange(event) {
      if (event.invalid) {
        this.invalid = true;
        return;
      }

      const inputName = event.type === 'email' ? 'emailAddress' : 'telegramId';

      this.invalid = false;

      if (!event.value){
        this.targets = {
          ...this.targets,
          [inputName]: ''
        }
      } else {
        let value = event.value;
        if (inputName === 'telegramId' && event.value[0] === '@') {
          value = event.value.substring(1)
        }

        this.targets = {
          ...this.targets,
          [inputName]: value
        }
      }
    },

    async handleClick() {
      this.loading = true;

      Object.keys(this.targets).forEach(key => {
        if (!this.targets[key]) delete this.targets[key]
      });

      const targetsPayload = {
        ...this.targets,
        name: 'Default',
      };
      const targetGroups = await this.notifiService.createTargetGroups(this.notifiClient, targetsPayload);
      
      this.contacts = {
        emailInfo: targetGroups.emailTargets.length > 0
                  ? targetGroups.emailTargets[0]
                  : null,
        telegramInfo: targetGroups.telegramTargets.length > 0
                      ? targetGroups.telegramTargets[0]
                      : null,
      }

      this.loading = false;
      this.editMode = false;
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

    span {
      display: inline-flex;
    }

    .edit-icon {
      margin-right: 4px;
      transform: translateY(-1px);
    }
  }

  .edit-container {
    position: relative;
    padding: 30px 24px 24px;
    border-radius: 12px;
    box-shadow: var(--edit-contact__edit-container-box-shadow);
    background-color: var(--edit-contact__edit-container-background-color);

    .close-icon {
      position: absolute;
      top: 7px;
      right: 7px;
      background: var(--modal__close-button-container-color);
      cursor: pointer;
    }

    .save-button {
      margin-top: 24px;
      display: flex;
      justify-content: end;
    }
  }
}

.link-text {
  display: flex;
  font-size: $font-size-xs;
  font-weight: 600;
  color: var(--edit-contact__contact-verify-color);
  cursor: pointer;
}

</style>