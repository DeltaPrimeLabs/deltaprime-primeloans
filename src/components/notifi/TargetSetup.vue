<template>
  <div class="notifi-target-setup notifi-modal__scroll">
    <div
      v-for="(alert, index) in alerts"
      v-bind:key="index"
      class="alert-option"
    >
      <img
        class="alert-option__icon-check"
        src="src/assets/icons/icon_tick_green.svg"
      >
      <div class="notifi-modal__text notifi-modal__text-label">{{ alert.label }}</div>
      <InfoIcon
        v-if="alert.tooltip"
        class="notifi-modal__info-icon"
        :tooltip="{content: alert.tooltip, placement: 'top', classes: 'info-tooltip'}"
      ></InfoIcon>
    </div>

    <div class="notifi-modal__separator"></div>

    <div class="notifi-modal__text notifi-modal__text-info choose-text">
      Choose at least one destination
    </div>

    <FormInput
      :type="'email'"
      :placeholder="'Email'"
      :leftIconSrc="'src/assets/icons/icon_email.svg'"
      :noSpace="true"
      @valueChange="handleChange"
      :validators="emailValidators"
    ></FormInput>

    <FormInput
      :inputType="'number'"
      :type="'phone'"
      :placeholder="'xxx-xx-xxx'"
      :leftIconSrc="'src/assets/icons/icon_phone.svg'"
      :noSpace="true"
      :validators="phoneValidators"
      @valueChange="handleChange"
    ></FormInput>

    <FormInput
      :type="'telegram'"
      :placeholder="'Telegram ID'"
      :leftIconSrc="'src/assets/icons/icon_telegram.svg'"
      :noSpace="true"
      @valueChange="handleChange"
    ></FormInput>

    <div class="next-button">
      <Button
        :label="'Next'"
        @click.stop.native="handleClick"
        :customStyle="customStyles.button"
        :disabled="invalid || !targets.emailAddress && !targets.phoneNumber && !targets.telegramId"
        :waiting="screenLoading"
        :rightIconSrc="'src/assets/icons/icon_arrow_s_white.svg'"
      ></Button>
    </div>
  </div>
</template>

<script>
import notifiConfig from './notifiConfig';
import Button from '../Button';
import InfoIcon from '../InfoIcon.vue';
import FormInput from '../FormInput.vue';

export default ({
  name: 'TargetSetup',
  components: {
    Button,
    FormInput,
    InfoIcon
  },
  props: {
    customStyles: { type: Object, default: () => {} },
    screenLoading: Boolean
  },
  data() {
    return {
      alerts: notifiConfig.ALERTS_CONFIG,
      targets: {},
      invalid: null,
      emailValidators: [],
      phoneValidators: []
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
            if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(value)) {
              return 'Your email address is invalid';
            }
          }
        }
      ]
      this.phoneValidators = [
        {
          validate: (value) => {
            if (!/^\d+$/.test(value)) {
              return 'Your phone number is invalid';
            }
          }
        }        
      ]
    },

    handleChange(event) {
      if (event.invalid) {
        this.invalid = true;
        return;
      }

      const inputName = event.type === 'email' ? 'emailAddress' : event.type === 'phone' ? 'phoneNumber' : 'telegramId';

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
        } else if (inputName === 'phoneNumber') {
          value = '+' + event.value;
        }

        this.targets = {
          ...this.targets,
          [inputName]: value
        }
      }
    },
    handleClick() {
      Object.keys(this.targets).forEach(key => {
        if (!this.targets[key]) delete this.targets[key]
      });

      console.log(this.targets);
      this.$emit('createTargets', this.targets);
    }
  }
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/notifi";

.notifi-target-setup {
  height: 470px;
  padding: 24px 30px;

  .alert-option {
    display: flex;
    align-items: center;
    margin-bottom: 18px;

    .alert-option__icon-check {
      margin-right: 8px;
    }

    &:last-child {
      margin-bottom: 23px;
    }
  }

  .choose-text {
    margin-top: 12px;
  }

  .next-button {
    margin-top: 24px;
    display: flex;
    justify-content: end;
  }
}
</style>