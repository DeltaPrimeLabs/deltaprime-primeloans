<template>
  <div
    class="add-borrow-rate"
  >
    <div
      v-if="!addWindow"
      class="add-rate-btn"
      @click="addWindow = true"
    >
      <img src="src/assets/icons/icon_a_plus_single.svg">
      Add Rate
    </div>
    <div
      v-if="addWindow"
      class="add-window"
    >
      <DeltaIcon
        class="close-icon"
        :icon-src="'src/assets/icons/cross.svg'"
        :size="17"
        @click.native="addWindow = false"
      ></DeltaIcon>
      <div>
        <div class="borrow-rate-edit">
          <div class="edit-box">
            <Dropdown
              :options="pools"
              @dropdownSelected="handleDropdownOption"
              ref="notifiDropdown"
            ></Dropdown>
          </div>
          <div class="edit-box">
            <RoundToggle
              :options="['Above', 'Below']"
              :initial-option="0"
              @toggleOptionSelected="handleToggleOption"
            ></RoundToggle>
          </div>
        </div>
        <div class="borrow-rate-edit">
          <div class="edit-box">
            <ApyInput
              @apyInput="handleApyInput"
            ></ApyInput>
          </div>
          <div class="edit-box">
            <Button
              :label="'Save'"
              :disabled="!poolAddress || !thresholdDirection || !threshold"
              @click.once="handleSave"
              :customStyle="buttonStyles"
              :waiting="saving"
            ></Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import DeltaIcon from '../../DeltaIcon.vue';
import Dropdown from './Dropdown.vue';
import RoundToggle from './RoundToggle.vue';
import ApyInput from './ApyInput.vue';
import Button from '../../Button.vue';
import notifiConfig from '../notifiConfig';
import { mapState } from 'vuex';

export default ({
  name: 'AddBorrowRate',
  components: {
    ApyInput,
    Button,
    DeltaIcon,
    Dropdown,
    RoundToggle
  },
  props: {
    notifiClient: null
  },
  computed: {
    ...mapState('serviceRegistry', ['notifiService'])
  },
  data() {
    return {
      addWindow: false,
      pools: notifiConfig.POOLS_CONFIG.map(pool => ({
        name: pool.name,
        value: pool.address
      })),
      poolAddress: null,
      thresholdDirection: 'above',
      threshold: null,
      saving: false,
      buttonStyles: {
        fontSize: "15px",
        padding: "7px 8px"
      }
    }
  },
  methods: {
    handleDropdownOption(option) {
      this.poolAddress = option.value;
    },

    handleToggleOption(option) {
      this.thresholdDirection = option.toLowerCase();
    },

    handleApyInput(apy) {
      this.threshold = parseFloat((apy / 100).toFixed(4));
    },

    async handleSave() {
      this.saving = true;
      const alert = {
        alertType: 'DELTA_PRIME_BORROW_RATE_EVENTS',
        toggle: true
      };
      const payload = {
        client: this.notifiClient,
        poolAddress: this.poolAddress,
        thresholdDirection: this.thresholdDirection,
        threshold: this.threshold
      };

      await this.notifiService.handleCreateAlert(alert, payload);

      this.saving = false;
      this.addWindow = false;
    },
  }
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.add-borrow-rate {
  display: flex;
  .add-rate-btn {
    display: flex;
    font-size: $font-size-xsm;
    font-weight: 600;
    color: var(--edit-contact__contact-verify-color);
    cursor: pointer;
    transform: translateX(-3px);
  }

  .add-window {
    position: relative;
    width: 100%;
    margin-bottom: 9px;
    padding: 30px 24px 24px;
    border-radius: 12px;
    box-shadow: var(--add-borrow-rate__container-box-shadow);
    background-color: var(--add-borrow-rate__container-background-color);

    .close-icon {
      position: absolute;
      top: 7px;
      right: 7px;
      background: var(--modal__close-button-container-color);
      cursor: pointer;
    }

    .borrow-rate-edit {
      display: flex;
      align-items: center;

      &:not(:first-child) {
        margin-top: 16px;
      }

      .edit-box {
        &:not(:first-child) {
          margin-left: 14px;
        }
      }
    }
  }
}
</style>