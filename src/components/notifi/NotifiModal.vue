<template>
  <div
    v-if="show"
    id="notifi-modal"
    class="notifi-modal-component"
  >
    <div class="modal-container">
      <!-- <div v-if="screenLoading">
        <VueLoadersBallBeat color="#A6A3FF" scale="1.5"></VueLoadersBallBeat>
      </div> -->
      <div
        v-if="currentScreen.title && currentScreen.componentName !== 'Login'"
        class="modal-header"
      >
        <IconButton
          v-show="currentScreen.backButton"
          class="header__left-arrow"
          :icon-src="'src/assets/icons/left-arrow.svg'"
          :size="20"
          :disabled="screenLoading"
          @click="handleBack"
        ></IconButton>

        <div class="header__text">
          <span class="notifi-modal__text notifi-modal__text-title">
            {{ currentScreen.title }}
          </span>
          <span
            v-if="currentScreen.topInfo"
            class="notifi-modal__text-title notifi-modal__text-info header__description"
          >
            {{ currentScreen.topInfo }}
          </span>
        </div>

        <IconButton
          v-show="currentScreen.settings"
          class="header__right-settings"
          :icon-src="'src/assets/icons/icon_settings.svg'"
          :size="22"
          @click="handleSettings"
        ></IconButton>
      </div>

      <div class="modal-content">
        <component
          :is="currentScreen.componentName"
          v-bind="{...currentScreen, ...notifi}"
          :screenLoading="screenLoading"
          :notification="selectedNotification"
          @loginNotifi="handleLogin"
          @createTargets="handleCreateTargets"
          @notificationDetail="handleNotificationDetail"
          @loadMoreHistory="loadMoreHistory"
        ></component>
      </div>

      <div class="modal-footer">
        <span class="footer__powered-by">Powered by</span>
        <img src="src/assets/logo/notifi_small_logo.svg" />
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import { combineLatest } from 'rxjs';
import notifiConfig from './notifiConfig';
import IconButton from "../IconButton.vue";
import Notifications from './Notifications.vue';
import NotificationDetail from './NotificationDetail.vue';
import Login from './Login.vue';
import Settings from './Settings.vue';
import TargetSetup from './TargetSetup.vue';

export default {
  name: 'NotifiModal',
  components: {
    IconButton,
    Login,
    Notifications,
    NotificationDetail,
    Settings,
    TargetSetup
  },
  props: {
    show: Boolean,
  },
  data() {
    return {
      notifi: null,
      currentScreen: null,
      screenLoading: false,
      selectedNotification: null
    }
  },
  computed: {
    ...mapState('network', ['provider', 'account']),
    ...mapState('serviceRegistry', ['providerService', 'accountService', 'notifiService']),
  },
  mounted() {
    this.setupNotifi();
    this.watchNotifi();
  },
  methods: {
    ...mapActions('notifiStore', ['notifiStoreSetup']),
    setupNotifi() {
      combineLatest([this.providerService.observeProviderCreated(), this.accountService.observeAccountLoaded()])
        .subscribe(() => {
          this.notifiStoreSetup();
        });
    },

    watchNotifi() {
      combineLatest([this.notifiService.observeNotifi()])
        .subscribe(([notifi]) => {
          this.notifi = notifi;
          this.screenLoading = false;

          if (!this.notifi || !this.notifi.authenticated) {
            // Login screen
            this.currentScreen = notifiConfig.SCREENS_CONFIG.login;
          } else if (!this.notifi.targetGroups || this.notifi.targetGroups.length == 0) {
            // Destination setup screen
            this.currentScreen = notifiConfig.SCREENS_CONFIG.targetSetup;
          } else {
            // Main screen - Notifications
            this.currentScreen = notifiConfig.SCREENS_CONFIG.notifications;
          }

          this.notifiService.emitCurrentScreen();
          // this.handleNotifi();
        })
    },

    refreshClientInfo() {
      // update client info and navigate to another screen
      this.notifiService.refreshClientInfo(this.notifi.client);
    },

    async handleLogin() {
      this.screenLoading = true;
      await this.notifiService.login(this.notifi.client, this.provider, this.account);
      this.refreshClientInfo();
    },

    async handleCreateTargets(targets) {
      const targetsPayload = {
        ...targets,
        name: 'Default',
      };

      this.screenLoading = true;
      await this.notifiService.createTargetGroups(this.notifi.client, targetsPayload);
      this.refreshClientInfo();
    },

    handleBack() {
      this.screenLoading = true;
      this.refreshClientInfo();
    },

    handleSettings() {
      this.currentScreen = notifiConfig.SCREENS_CONFIG.settings;
    },

    handleNotificationDetail(notification) {
      this.selectedNotification = notification;
      this.currentScreen = notifiConfig.SCREENS_CONFIG.notificationDetail;
    },

    async loadMoreHistory(after) {
      const moreHistory = await this.notifiService.getNotifications(this.notifi.client, after);
      this.notifiService.emitLoadHistory(moreHistory);
    },

    async handleNotifi() {
      // const data = await this.notifi.client.fetchData();
      // console.log(data);
      // for (const alert of data.alert) {
      //   console.log(alert.id);
      //   this.notifi.client.deleteAlert({id: alert.id});
      // }

      // const targetPayload = {
      //   name: 'Default',
      //   telegramId: 'crypteristic',
      //   phoneNumber: '+13474671201',
      //   emailAddress: 'willie.lee226@gmail.com'
      // };
      // await this.notifiService.createTargetGroups(this.notifi.client, targetPayload);

      // const name = `Borrow Rate Alerts: 0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b below 14`;
      // const eventType = {
      //   type: 'custom',
      //   name,
      //   sourceType: 'DELTA_PRIME_LENDING_RATES',
      //   filterType: 'DELTA_PRIME_BORROW_RATE_EVENTS',
      //   sourceAddress: {
      //     type: "value",
      //     value: "0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b",
      //   },
      //   selectedUIType: "TOGGLE",
      //   filterOptions: {
      //     alertFrequency: 'QUARTER_HOUR',
      //     threshold: 0.14,
      //     thresholdDirection: 'below',
      //   },
      // }

      // const inputs = {
      //   // ['Loan Health Alerts__healthRatio']: 0.9, // in percent, like 100
      // };

      // await this.notifiService.createAlert(this.notifi.client, this.account, eventType, inputs);
      // this.notifiService.createLoanHealthAlerts(this.notifi.client, this.account, 0.9);
    }
  }
}
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/notifi";

.notifi-modal-component {
  position: absolute;
  top: 30px;
  right: -30px;
  z-index: 5;

  .modal-container {
    display: flex;
    flex-direction: column;
    width: 370px;
    margin: 0 auto;
    border-radius: 25px;
    box-shadow: var(--notifi-modal__container-box-shadow);
    border: var(--notifi-modal__container-border);
    background-color: var(--notifi-modal__container-background-color);
    color: var(--default-text-color);
    font-weight: normal;

    .modal-header {
      width: 100%;
      display: flex;
      padding: 24px 30px 20px;
      border-bottom: solid 1px var(--notifi-modal__container-inner-border-color);
      box-shadow: var(--notifi-modal__container-header-box-shadow);

      .header__left-arrow {
        margin-right: 14px;
        line-height: normal;
      }

      .header__text {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;

        .header__description {
          margin-top: 4px;
        }
      }

      .header__right-settings {
        transform: translateX(14px);
        line-height: normal;
      }
    }

    .modal-content {
      flex: auto;
      width: 100%;
    }

    .modal-footer {
      width: 100%;
      height: 38px;
      display: flex;
      justify-content: center;
      align-items: center;
      border-top: solid 1px var(--notifi-modal__container-inner-border-color);
      box-shadow: var(--notifi-modal__container-footer-box-shadow);

      .footer__powered-by {
        margin-right: 7.8px;
        font-family: 'Roboto';
        font-size: 8.1px;
        letter-spacing: 0.08px;
        line-height: 1.33;
        color: var(--notifi-modal__container-footer-font-color);
      }
    }

    .loader {
      width: 100%;
      height: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}
</style>