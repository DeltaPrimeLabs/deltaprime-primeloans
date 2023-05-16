<template>
  <div class="notifi-settings notifi-modal__scroll">
    <div v-if="screenLoading" class="loader">
      <VueLoadersBallBeat
        color="#A6A3FF"
        scale="1"
      ></VueLoadersBallBeat>
    </div>

    <template v-if="!screenLoading">
      <EditContact
        :emailInfo="emailInfo"
        :phoneInfo="phoneInfo"
        :telegramInfo="telegramInfo"
      ></EditContact>

      <div class="switch-options">
        <div
          v-for="(alert, index) in alertSettings"
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
              :tooltip="{ content: alert.tooltip, placement: 'top', classes: 'info-tooltip' }"
            ></InfoIcon>
            <div
              v-if="alert.toggle"
              class="alert-toggle"
            >
              <ToggleButton
                v-if="alert.toggle"
                :alertId="alert.id"
                :alertType="alert.type"
                :toggleOn="alert.created"
                @alertToggle="handleAlertToggle"
              ></ToggleButton>
            </div>
          </div>

          <template v-if="alert.thresholdOptions">
            <div class="notifi-modal__text notifi-modal__text-info alert-note">
              {{ alert.settingsNote }}
            </div>
            <div class="health-rate-thresholds">
              <HealthRateButton
                v-for="rate in healthRates"
                v-bind:key="rate.id"
                :rate="rate"
                :active="selectedHealthRate && selectedHealthRate.id === rate.id"
                @rateClick="handleRateClick"
              ></HealthRateButton>
            </div>
          </template>

          <template v-if="alert.type === 'DELTA_PRIME_BORROW_RATE_EVENTS'">
            <AddInterestRate
              @borrowInterestRate="handleBorrowRate"
            ></AddInterestRate>
            <div
              v-for="(option, id) in alert.filterOptions"
              v-bind:key="id"
              class="interest-rate"
            >
              <span>{{ option.thresholdDirection|title }}&nbsp;</span>
              <span class="rate__value">{{ option.threshold|percent }}</span>&nbsp;APY %
              <span class="rate__asset-name">{{ addressToPoolName(option.poolAddress) }}</span>
              <span class="remove-icon">&times;</span>
            </div>
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
      selectedHealthRate: null,
      healthRateToggle: null,
      pools: notifiConfig.POOLS_CONFIG
    }
  },
  computed: {
    ...mapState('network', ['account']),
    ...mapState('serviceRegistry', ['notifiService']),
    ...mapState('notifiStore', ['alertSettings']),
  },
  mounted() {
    console.log(this.alertSettings);
    this.selectedHealthRate = this.alertSettings['DELTA_PRIME_LENDING_HEALTH_EVENTS'].filterOptions
        && (this.alertSettings['DELTA_PRIME_LENDING_HEALTH_EVENTS'].filterOptions.threshold == 0.6
        ? notifiConfig.HEALTH_RATES_CONFIG[0]
        : this.alertSettings['DELTA_PRIME_LENDING_HEALTH_EVENTS'].filterOptions.threshold == 0.7
        ? notifiConfig.HEALTH_RATES_CONFIG[1]
        : null);
    this.healthRateToggle = this.alertSettings['DELTA_PRIME_LENDING_HEALTH_EVENTS'].created
  },
  methods: {
    ...mapActions('notifiStore', ['handleCreateAlert']),
    async handleRateClick(rate) {
      this.selectedHealthRate = rate;

      if (!this.healthRateToggle) return;

      this.handleCreateAlert({
        alert: {
          alertType: 'DELTA_PRIME_LENDING_HEALTH_EVENTS',
          toggle: this.alertSettings['DELTA_PRIME_LENDING_HEALTH_EVENTS'].toggle
        },
        payload: {
          client: this.client,
          walletAddress: this.account,
          healthRatio: this.selectedHealthRate.value / 100.0
        }
      });
    },

    handleAlertToggle(alert) {
      switch (alert.alertType) {
        case "BROADCAST_MESSAGES":
          this.handleCreateAlert({
            alert,
            payload: { client: this.client }
          });
          break;
        case "LIQUIDATIONS":
          this.handleCreateAlert({
            alert,
            payload: {
              client: this.client,
              walletAddress: this.account
            }
          });
          break;
        case "DELTA_PRIME_LENDING_HEALTH_EVENTS":
          this.healthRateToggle = alert.toggle;

          if (!this.selectedHealthRate) break;

          this.handleCreateAlert({
            alert,
            payload: {
              client: this.client,
              walletAddress: this.account,
              healthRatio: this.selectedHealthRate.value / 100.0
            }
          });
          break;
        case "DELTA_PRIME_BORROW_RATE_EVENTS":
          // this.handleCreateAlert({
          //   alert,
          //   payload: {
          //     client: this.client,
          //     poolAddress: poolAddress,
          //     thresholdDirection: thresholdDirection,
          //     threshold: threshold,
          //   }
          // });
          break;
      }
    },

    handleBorrowRate(rate) {
      console.log(rate);
      this.notifiService.createBorrowRateAlerts({
        client: this.client,
        poolAddress: rate.poolAddress,
        thresholdDirection: rate.thresholdDirection,
        threshold: rate.threshold
      });
    },

    addressToPoolName(address) {
      console.log(address);
      const pool = this.pools.find(pool => pool.address.toLowerCase() === address.toLowerCase());
      return pool.name;
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

    .interest-rate {
      display: flex;
      padding: 8px 0 6px;
      font-family: Montserrat;
      font-size: $font-size-xsm;
      font-weight: 500;
      font-stretch: normal;
      font-style: normal;
      line-height: normal;
      letter-spacing: normal;
      color: var(--notifi-modal__container-info-color);
      border-top: var(--notifi-settings__borrow-rate-border);

      .rate__value {
        color: var(--notifi-modal__container-common-color);
      }

      .rate__asset-name {
        flex: auto;
        text-align: right;
        margin-right: 12px;
      }

      .remove-icon {
        font-size: 25px;
        line-height: 18px;
        cursor: pointer;

        &:hover {
          color: $black;
        }
      }

      &:first-child {
        margin-top: 6.5px;
      }

      &:not(:first-child) {
        border-bottom: var(--notifi-settings__borrow-rate-border);
      }
    }
  }
}
</style>