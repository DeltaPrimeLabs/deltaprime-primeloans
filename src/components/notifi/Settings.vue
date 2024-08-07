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
        :telegramInfo="telegramInfo"
        :notifiClient="client"
      ></EditContact>

      <div class="alert-settings">
        <div
          v-for="(alert, index) in alertSettings"
          v-bind:key="index"
          class="alert-box"
        >
          <div class="notifi-modal__separator"></div>

          <div :class="['alert-option', alert.settingsNote ? 'has-alert-note' : '']">
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
                @toggleChange="handleAlertToggle"
              ></ToggleButton>
            </div>
          </div>

          <div v-if="alert.thresholdOptions">
            <div class="notifi-modal__text notifi-modal__text-info alert-note">
              {{ alert.settingsNote }}
            </div>
            <div class="health-rate-thresholds">
              <HealthRateButton
                v-for="rate in healthRates"
                v-bind:key="rate.id"
                :custom="rate.id === 'custom'"
                :rate="rate"
                :selectedRate="selectedHealthRate.value"
                :active="selectedHealthRate && selectedHealthRate.id === rate.id"
                @rateClick="handleRateClick"
              ></HealthRateButton>
            </div>
          </div>

          <div v-if="alert.type === 'borrowRate' || alert.type === 'lendingRate'">
            <AddInterestRate
              :notifiClient="client"
              :alertType="alert.type"
            ></AddInterestRate>
            <div>
              <div
                v-for="(option, id) in alert.filterOptions"
                v-bind:key="id"
                class="interest-rate"
              >
                <span>{{ option.thresholdDirection|title }}&nbsp;</span>
                <span class="rate__value">{{ (option.threshold * 100).toFixed(2) }}</span>&nbsp;APY %
                <span class="rate__asset-name">{{ addressToPoolName(option.poolAddress) }}</span>
                <span
                  class="remove-icon"
                  @click.stop="handleRemoveInterestRate(option.id, alert.type)"
                >
                  &times;
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import EditContact from './settings/EditContact.vue';
import HealthRateButton from './settings/HealthRateButton.vue';
import InfoIcon from '../InfoIcon.vue';
import ToggleButton from './settings/ToggleButton.vue';
import AddInterestRate from './settings/AddInterestRate.vue';
import notifiConfig from './notifiConfig';
import config from '@/config';

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
    alertSettings: { type: Object, default: () => {} },
    client: null
  },
  data() {
    return {
      emailInfo: this.targetGroups[0].emailTargets.length > 0
        ? this.targetGroups[0].emailTargets[0]
        : null,
      telegramInfo: this.targetGroups[0].telegramTargets.length > 0
        ? this.targetGroups[0].telegramTargets[0]
        : null,
      healthRates: null,
      selectedHealthRate: null,
      healthRateToggle: null,
      pools: Object.values(config.POOLS_CONFIG).map((pool, index) => ({
        name: Object.keys(config.POOLS_CONFIG)[index],
        address: pool.address
      })),
    }
  },
  computed: {
    ...mapState('network', ['account']),
    ...mapState('serviceRegistry', ['notifiService'])
  },
  mounted() {
    if (this.$route.name === 'Pools') return;

    const currentHealthRate = this.alertSettings['loanHealth'];
    const healthRates = notifiConfig.HEALTH_RATES_CONFIG;
    this.selectedHealthRate = healthRates[1]; // default health rate: 20%

    if (currentHealthRate.filterOptions && currentHealthRate.filterOptions.threshold) {
      switch (currentHealthRate.filterOptions.threshold) {
        case 0.1: // 10%
          this.selectedHealthRate = healthRates[0];
          break;
        case 0.2: // 20%
          this.selectedHealthRate = healthRates[1];
          break;
        default:
          this.selectedHealthRate = healthRates[2];
          this.selectedHealthRate.value = parseFloat((currentHealthRate.filterOptions.threshold * 100).toFixed(2));
          break;
      };
    }

    this.healthRates = healthRates;
    this.healthRateToggle = currentHealthRate.created;
  },
  methods: {
    async handleRateClick(rate) {
      this.selectedHealthRate = rate;

      if (!this.healthRateToggle) return;

      const alert = {
        alertType: 'loanHealth',
        toggle: this.alertSettings['loanHealth'].toggle
      };
      const payload = {
        client: this.client,
        walletAddress: this.account,
        healthRatio: parseFloat((this.selectedHealthRate.value / 100.0).toFixed(4)),
        network: window.chain
      };

      this.notifiService.handleCreateAlert(alert, payload);
    },

    handleAlertToggle(alert) {
      let payload = {};

      switch (alert.alertType) {
        case "announcement":
          payload = { 
            client: this.client,
            targetGroupId: this.targetGroups[0].id,
            alertType: "announcement",
          };
          break;
        case "liquidation":
          payload = {
            client: this.client,
            walletAddress: this.account
          };
          break;
        case "loanHealth":
          this.healthRateToggle = alert.toggle;

          if (!this.selectedHealthRate) break;

          payload = {
            client: this.client,
            walletAddress: this.account,
            healthRatio: this.selectedHealthRate.value / 100.0
          };
          break;
      }

      payload = {
        ...payload,
        network: window.chain
      }

      this.notifiService.handleCreateAlert(alert, payload);
    },

    handleRemoveInterestRate(alertId, alertType) {
      const alert = {
        alertType,
        toggle: false,
        alertId
      };
      const payload = {
        client: this.client,
        network: window.chain
      }

      this.notifiService.handleCreateAlert(alert, payload);
    },

    addressToPoolName(address) {
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
  height: 530px;
  display: flex;
  flex-direction: column;

  .alert-settings {
    margin-bottom: 20px;

    .alert-box {
      padding: 0 30px;

      .alert-option {
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

        &:last-child {
          border-bottom: var(--notifi-settings__borrow-rate-border);
        }
      }
    }
  }
}
</style>