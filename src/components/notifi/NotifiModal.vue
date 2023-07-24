<template>
  <div
    v-if="show"
    id="notifi-modal"
    class="notifi-modal-component"
  >
    <div class="modal-container">
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
          @click.stop.native="handleBack"
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
          @click.stop.native="handleSettings"
        ></IconButton>
      </div>

      <div class="modal-content">
        <component
          :is="currentScreen.componentName"
          v-bind="{...currentScreen, ...notifi}"
          :screenLoading="screenLoading"
          :notification="selectedNotification"
          :customStyles="customStyles"
          :alertSettings="alertSettings"
          @loginNotifi="handleLogin"
          @createTargets="handleCreateTargets"
          @notificationDetail="handleNotificationDetail"
          @loadMoreHistory="loadMoreHistory"
        ></component>
      </div>

      <div class="modal-footer">
        <span class="footer__powered-by">Powered by</span>
        <img :src="notifiImgSrc" />
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
      selectedNotification: null,
      customStyles: notifiConfig.customStyles,
      alertSettings: null,
      notifiImgSrc: null
    }
  },
  computed: {
    ...mapState('network', ['provider', 'account']),
    ...mapState('serviceRegistry', ['providerService',
      'accountService',
      'notifiService',
      'themeService'
    ]),
  },
  mounted() {
    this.setupNotifi();
    this.watchNotifi();
    this.watchAlertSettingsLoaded();
    this.watchThemeChange();
  },
  methods: {
    setupNotifi() {
      combineLatest([this.providerService.observeProviderCreated(), this.accountService.observeAccountLoaded()])
        .subscribe(([provider, account]) => {
          const alertsConfig = this.$route.name === 'Pools'
                              ? notifiConfig.ALERTS_CONFIG.pools
                              : notifiConfig.ALERTS_CONFIG.primeAccount;

          this.notifiService.setupNotifi(account, alertsConfig);
        });
    },

    watchNotifi() {
      this.notifiService.observeNotifi().subscribe((notifi) => {
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
        })
    },

    watchAlertSettingsLoaded() {
      this.notifiService.observeAlertSettingsUpdated().subscribe(() => {
        this.alertSettings = {...this.notifiService.alertSettings};
      });
    },

    watchThemeChange() {
      this.themeService.observeThemeChange().subscribe((theme) => {
        if (theme === 'DARK') {
          this.notifiImgSrc = 'src/assets/logo/notifi_small_logo_white.svg';
        } else {
          this.notifiImgSrc = 'src/assets/logo/notifi_small_logo.svg';
        }
      })
    },

    refreshClientInfo() {
      // update client info and navigate to another screen
      this.notifiService.refreshClientInfo(this.notifi.client);
    },

    async handleLogin() {
      try {
        this.screenLoading = true;
        await this.notifiService.login(this.notifi.client, this.provider, this.account);
        this.refreshClientInfo();
      } catch(e) {
        console.log("Login Notifi Error", e);
        this.refreshClientInfo();
      }
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