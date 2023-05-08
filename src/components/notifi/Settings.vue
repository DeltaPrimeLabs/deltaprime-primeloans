<template>
  <div class="notifi-settings notifi-modal__scroll">
    <div v-if="screenLoading" class="loader">
      <VueLoadersBallBeat color="#A6A3FF" scale="1"></VueLoadersBallBeat>
    </div>

    <template v-if="!screenLoading">
      <EditContact
        :emailInfo="emailInfo"
        :phoneInfo="phoneInfo"
        :telegramInfo="telegramInfo"
      >
      </EditContact>

      <div class="switch-options">
        <div
          v-for="(alert, index) in alerts"
          v-bind:key="index"
        >
          <div class="notifi-modal__separator"></div>

          <div :class="['alert-switch', alert.settingsNote ? 'has-alert-note' : '']">
            <div class="notifi-modal__text-label">
              {{ alert.label }}
            </div>
            <InfoIcon
              v-if="alert.tooltip"
              class="notifi-modal__info-icon"
              :tooltip="{content: alert.tooltip, placement: 'top', classes: 'info-tooltip'}"
            ></InfoIcon>
            <div
              v-if="alert.toggle"
              class="alert-toggle"
            >
              <ToggleButton v-if="alert.toggle"></ToggleButton>
            </div>
          </div>

          <template v-if="alert.settingsNote">
            <div class="notifi-modal__text notifi-modal__text-info alert-note">
              {{ alert.settingsNote }}
            </div>
            <div class="health-rate-thresholds">
              <HealthRateButton
                v-for="rate in healthRates"
                v-bind:key="rate.id"
                :rate="rate"
                :active="clickedHealthRate === rate.id"
                @rateClick="handleRateClick"
              ></HealthRateButton>
            </div>
          </template>

          <template v-if="alert.id === 'interestRate'">
            <AddInterestRate></AddInterestRate>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import EditContact from './EditContact.vue';
import HealthRateButton from './HealthRateButton.vue';
import InfoIcon from '../InfoIcon.vue';
import ToggleButton from './ToggleButton.vue';
import AddInterestRate from './AddInterestRate.vue';
import notifiConfig from './notifiConfig';

export default ({
  name: 'Settings',
  components: {
    EditContact,
    HealthRateButton,
    InfoIcon,
    ToggleButton,
    AddInterestRate
  },
  props: {
    screenLoading: { type: Boolean, default: false },
    targetGroups: { type: Array, default: () => [] }
  },
  data() {
    return {
      emailInfo: this.targetGroups[0].emailTargets.length > 0
                ? this.targetGroups[0].emailTargets[0]
                : {},
      phoneInfo: this.targetGroups[0].smsTargets.length > 0
                ? this.targetGroups[0].smsTargets[0]
                : {},
      telegramInfo: this.targetGroups[0].telegramTargets.length > 0
                ? this.targetGroups[0].telegramTargets[0]
                : {},
      alerts: notifiConfig.ALERTS_CONFIG,
      healthRates: notifiConfig.HEALTH_RATES_CONFIG,
      clickedHealthRate: null
    }
  },
  mounted() {},
  methods: {
    handleRateClick(rate) {
      this.clickedHealthRate = rate.id;
      console.log(rate.value)
    }
  }
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/notifi";

.notifi-settings {
  height: 470px;
  display: flex;
  flex-direction: column;

  .switch-options {
    padding: 0 30px;

    .alert-switch {
      display: flex;
      align-items: center;
      margin: 12px 0;

      .alert-toggle {
        flex: auto;
        display: flex;
        justify-content: end;
      }

      &.has-alert-note {
        margin-bottom: 6px;
      }
    }

    .alert-note {
      width: 230px;
    }

    .health-rate-thresholds {
      margin-top: 16px;
      margin-bottom: 19px;
      display: flex;
    }
  }
}

</style>