<template>
  <div class="notifi-settings notifi-modal__scroll">
    <div v-if="screenLoading" class="loader">
      <VueLoadersBallBeat color="#A6A3FF" scale="1"></VueLoadersBallBeat>
    </div>

    <template v-if="!screenLoading">
      <EditContact :emailInfo="emailInfo" :phoneInfo="phoneInfo" :telegramInfo="telegramInfo">
      </EditContact>

      <div class="switch-options">
        <div v-for="(alert, index) in alertOptions" v-bind:key="index">
          <div class="notifi-modal__separator"></div>

          <div :class="['alert-switch', alert.settingsNote ? 'has-alert-note' : '']">
            <div class="notifi-modal__text-label">
              {{ alert.label }}
            </div>
            <InfoIcon v-if="alert.tooltip" class="notifi-modal__info-icon"
              :tooltip="{ content: alert.tooltip, placement: 'top', classes: 'info-tooltip' }"></InfoIcon>
            <div v-if="alert.toggle" class="alert-toggle">
              <ToggleButton v-if="alert.toggle" :alertId="alert.id" :alertType="alert.type" :toggleOn="alert.created"
                @alertToggle="handleAlertToggle"></ToggleButton>
            </div>
          </div>

          <template v-if="alert.settingsNote">
            <div class="notifi-modal__text notifi-modal__text-info alert-note">
              {{ alert.settingsNote }}
            </div>
            <div class="health-rate-thresholds">
              <HealthRateButton v-for="rate in healthRates" v-bind:key="rate.id" :rate="rate"
                :active="clickedHealthRate.id === rate.id" @rateClick="handleRateClick"></HealthRateButton>
            </div>
          </template>

          <template v-if="alert.type === 'borrowRate'">
            <AddInterestRate></AddInterestRate>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
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
    targetGroups: { type: Array, default: () => [] },
    alerts: { type: Array, default: () => [] },
    client: null
  },
  data() {
    return {
      emailInfo: this.targetGroups[0].emailTargets.length > 0
        ? this.targetGroups[0].emailTargets[0]
        : null,
      phoneInfo: this.targetGroups[0].smsTargets.length > 0
        ? this.targetGroups[0].smsTargets[0]
        : null,
      telegramInfo: this.targetGroups[0].telegramTargets.length > 0
        ? this.targetGroups[0].telegramTargets[0]
        : null,
      healthRates: notifiConfig.HEALTH_RATES_CONFIG,
      clickedHealthRate: notifiConfig.HEALTH_RATES_CONFIG[1],
    }
  },
  computed: {
    ...mapState('network', ['account']),
    ...mapState('serviceRegistry', ['notifiService']),
    alertOptions() {
      const alertsConfig = notifiConfig.ALERTS_CONFIG;

      for (const alert of this.alerts) {
        alertsConfig[alert.filter.filterType]['id'] = alert.id;
        alertsConfig[alert.filter.filterType]['created'] = true;
      }

      return alertsConfig;
    }
  },
  methods: {
    async handleRateClick(rate) {
      this.clickedHealthRate = rate;
      if (this.alertOptions.DELTA_PRIME_LENDING_HEALTH_EVENTS['created']) {
        await this.notifiService.deleteAlert(this.client, this.alertOptions.DELTA_PRIME_LENDING_HEALTH_EVENTS['id']);
        this.notifiService.createLoanHealthAlerts(this.client, this.account, rate.value / 100.0)
      }
    },

    handleAlertToggle(alert) {
      if (!alert.toggle) {
        this.notifiService.deleteAlert(this.client, alert.alertId);
      } else {
        switch (alert.alertType) {
          case "announcements":
            this.notifiService.createAnnouncements(this.client);
            break;
          case "liquidation":
            this.notifiService.createLiquidationAlerts(this.client, this.account);
            break;
          case "loanHealth":
            this.notifiService.createLoanHealthAlerts(this.client, this.account, this.clickedHealthRate.value / 100.0)
            break;
          case "borrowRate":
            // this.notifiService.createBorrowRateAlerts(this.client);
            break;
        }
      }
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