import { Subject } from 'rxjs';
const { newFrontendClient } = require('@notifi-network/notifi-frontend-client');
import { signMessageForNotifi } from '../utils/blockchain';
import config from '../config';

export default class notifiService {
  notifi$ = new Subject();
  currentScreen$ = new Subject();
  loadHistory$ = new Subject();
  alertSettingsUpdated$ = new Subject();
  alertSettings = {};

  emitNotifi(notifi) {
    this.notifi$.next(notifi);
  }

  observeNotifi() {
    return this.notifi$.asObservable();
  }

  emitCurrentScreen() {
    this.currentScreen$.next(null);
  }

  observeCurrentScreen() {
    return this.currentScreen$.asObservable();
  }

  emitLoadHistory(history) {
    this.loadHistory$.next(history);
  }

  observeLoadHistory() {
    return this.loadHistory$.asObservable();
  }

  emitAlertSettingsUpdated() {
    this.alertSettingsUpdated$.next(null);
  }

  observeAlertSettingsUpdated() {
    return this.alertSettingsUpdated$.asObservable();
  }

  // we call this only once to set up notifi client
  async setupNotifi(account, alertsConfig) {

    const walletBlockchain = window.chain.toUpperCase();
    const walletPublicKey = account;
    const tenantId = 'deltaprime';
    const blockchainEnv = 'Production';

    const newFrontendConfig = {
      account: {
        publicKey: walletPublicKey
      },
      walletBlockchain,
      tenantId,
      env: blockchainEnv
    };

    const client = newFrontendClient(newFrontendConfig);
    const notifi = await this.refreshClientInfo(client);

    // alerts states for setting screen
    this.alertSettings = alertsConfig;

    if (notifi.alerts) {
      for (const alert of notifi.alerts) {
        // get alerts statuses for initialization on settings screen
        let fusionEvent;

        if (alert.filter.filterType == 'BROADCAST_MESSAGES') {
          fusionEvent = ['announcement'];
        } else {
          fusionEvent = Object.entries(config.fusionEventIds).find(([name, eventId]) => eventId == alert.sourceGroup.sources[0].fusionEventTypeId);
        }

        if (this.alertSettings[fusionEvent[0]]) {
          this.alertSettings[fusionEvent[0]]['created'] = true;

          if (fusionEvent[0] === 'borrowRate' || fusionEvent[0] === 'lendingRate') {
            // we can have multiple borrow rate alerts with differnt thresholds
            if (!this.alertSettings[fusionEvent[0]]['filterOptions']) this.alertSettings[fusionEvent[0]]['filterOptions'] = [];
            this.alertSettings[fusionEvent[0]]['filterOptions'].push({
              ...JSON.parse(alert.filterOptions),
              poolAddress: alert.sourceGroup.sources[0].blockchainAddress,
              id: alert.id
            });
          } else {
            this.alertSettings[fusionEvent[0]]['id'] = alert.id;
            this.alertSettings[fusionEvent[0]]['filterOptions'] = JSON.parse(alert.filterOptions);
          }
        }
      }
    }

    this.emitAlertSettingsUpdated();
  }

  async refreshClientInfo(client) {
    // check if user already authenticated by notifi
    const initRes = await client.initialize();
    const authenticated = initRes.status === 'authenticated';
    let data = {};
    let history = {};

    if (authenticated) {
      // get user's targets and alerts configured
      data = await client.fetchData();
      history = await this.getNotifications(client);
    }

    const notifi = {
      client,
      authenticated,
      targetGroups: data.targetGroup,
      alerts: data.alert,
      history
    };

    this.emitNotifi(notifi);
    return notifi;
  }

  async login(client, provider, account) {
    const loginResult = await client.logIn({
      walletBlockchain: window.chain.toUpperCase(),
      signMessage: async (message) => {
        const { signedMessage } = await signMessageForNotifi(
          provider,
          message,
          account
        );

        return signedMessage;
      },
    });

    // client should be authenticated now
  }

  async createTargetGroups(client, targetPayload) {
    const targetGroups = await client.ensureTargetGroup(targetPayload);

    return targetGroups;
  }

  async handleCreateAlert(alert, payload) {
    this.alertSettings[alert.alertType]['created'] = alert.toggle;

    if (!alert.toggle) {
      if (alert.alertType === 'borrowRate' || alert.alertType === 'lendingRate') {
        this.alertSettings[alert.alertType]['filterOptions'] =
          this.alertSettings[alert.alertType]['filterOptions'].filter((option) => option.id != alert.alertId);
      }
      this.deleteAlert(payload.client, alert.alertId);
    } else {
      const alertRes = await this[this.alertSettings[alert.alertType].createMethod](payload);

      if (!alertRes.id) return;

      // update alerts states for settings screen
      if (alert.alertType === 'borrowRate' || alert.alertType === 'lendingRate') {
        if (!this.alertSettings[alert.alertType]['filterOptions']) this.alertSettings[alert.alertType]['filterOptions'] = [];
        this.alertSettings[alert.alertType]['filterOptions'].push({
          ...JSON.parse(alertRes.filterOptions),
          poolAddress: payload.poolAddress,
          id: alertRes.id
        });
      } else {
        this.alertSettings[alert.alertType]['id'] = alertRes.id;
        this.alertSettings[alert.alertType]['filterOptions'] = JSON.parse(alertRes.filterOptions);
      }
    }

    this.emitAlertSettingsUpdated();
  }

  async createAnnouncements({ client }) {
    const eventType = {
      type: 'broadcast',
      name: 'DeltaPrime Announcements',
      broadcastId: {
        type: 'value',
        value: 'deltaprime__announcements'
      },
    }

    const result = await client.ensureAlert({
      eventType,
      inputs: {},
    });

    return result;
  }

  /*
  alertFrequency options
  - ALWAYS
  - SINGLE
  - QUARTER_HOUR
  - HOURLY
  - DAILY
  */

  async createLiquidationAlerts({ client, walletAddress, network }) {
    const eventType = {
      type: 'fusion',
      name: 'Liquidation Alerts',
      // sourceType: 'DELTA_PRIME',
      // filterType: 'LIQUIDATIONS',
      sourceAddress: {
        type: 'ref',
        ref: 'walletAddress',
      },
      selectedUIType: 'TOGGLE',
      fusionEventId: {
        type: 'value',
        value: config.fusionEventIds.liquidation
      },
      alertFrequency: 'DAILY',
      // filterOptions: {},
    };
  
    const result = await client.ensureAlert({
      eventType,
      inputs: {
        walletAddress,
      },
    });
  
    return result;
  }

  async createLoanHealthAlerts({ client, walletAddress, healthRatio, network }) {
    const eventType = {
      type: 'fusion',
      name: 'Loan Health Alerts',
      fusionEventId: {
        type: 'value',
        value: config.fusionEventIds.loanHealth
      },
      // sourceType: 'DELTA_PRIME',
      // filterType: 'DELTA_PRIME_LENDING_HEALTH_EVENTS',
      sourceAddress: {
        type: 'ref',
        ref: 'walletAddress',
      },
      selectedUIType: 'HEALTH_CHECK',
      alertFrequency: 'DAILY',
      checkRatios: [
        { type: 'below', ratio: 1 },
        { type: 'above', ratio: 0 }
      ], // fallback number
      healthCheckSubtitle: '', // mandatory but unused field
      numberType: 'integer',
    }
  
    const result = await client.ensureAlert({
      eventType,
      inputs: {
        walletAddress,
        ['Loan Health Alerts__healthRatio']: healthRatio, // in decimal like 0.05 for 5%
      },
    });
  
    return result;
  }

  async createBorrowRateAlerts({ client, poolAddress, thresholdDirection, threshold, network }) {
    const name = `Borrow Rate Alerts: ${poolAddress} ${thresholdDirection} ${threshold}`;
    const eventType = {
      type: 'fusion',
      name,
      fusionEventId: {
        type: 'value',
        value: config.fusionEventIds.borrowRate
      },
      // sourceType: 'DELTA_PRIME_LENDING_RATES',
      // filterType: 'DELTA_PRIME_BORROW_RATE_EVENTS',
      sourceAddress: {
        type: 'value',
        value: poolAddress,
      },
      // selectedUIType: 'TOGGLE',
      // filterOptions: {
      //   alertFrequency: 'DAILY',
      //   threshold,
      //   thresholdDirection,
      // },
      selectedUIType: 'HEALTH_CHECK',
      healthCheckSubtitle: '', // mandatory but unused field
      numberType: 'integer',
      checkRatios: [
        { type: 'below', ratio: 1 },
        { type: 'above', ratio: 0 }
      ], // fallback number
      alertFrequency: 'DAILY', // optional
    }

    const result = await client.ensureAlert({
      eventType,
      inputs: {
        [`${name}__healthRatio`]: threshold,
        [`${name}__healthThresholdDirection`]: thresholdDirection,
      },
    });

    return result;
  }

  async createLendingRateAlerts({ client, poolAddress, thresholdDirection, threshold, network }) {
    const name = `Lending Rate Alerts: ${poolAddress} ${thresholdDirection} ${threshold}`;
    const eventType = {
      type: 'fusion',
      name,
      fusionEventId: {
        type: 'value',
        value: config.fusionEventIds.lendingRate
      },
      // sourceType: 'DELTA_PRIME_LENDING_RATES',
      // filterType: 'DELTA_PRIME_SUPPLY_RATE_EVENTS',
      sourceAddress: {
        type: 'value',
        value: poolAddress,
      },
      // selectedUIType: 'TOGGLE',
      // filterOptions: {
      //   alertFrequency: 'DAILY',
      //   threshold,
      //   thresholdDirection,
      // },
      selectedUIType: 'HEALTH_CHECK',
      healthCheckSubtitle: '', // mandatory but unused field
      numberType: 'integer',
      checkRatios: [
        { type: 'below', ratio: 1 },
        { type: 'above', ratio: 0 }
      ], // fallback number
      alertFrequency: 'DAILY', // optional
    }

    const result = await client.ensureAlert({
      eventType,
      inputs: {
        [`${name}__healthRatio`]: threshold,
        [`${name}__healthThresholdDirection`]: thresholdDirection,
      },
    });

    return result;
  }

  async getNotifications(client, after, first = 20) {
    const history = await client.getNotificationHistory({
      after,
      first
    });

    return history;
  }

  async sendEmailTargetVerification(client, targetId) {
    const id = await client.sendEmailTargetVerification({ targetId });
    return id;
  }

  async deleteAlert(client, alertId) {
    await client.deleteAlert({ id: alertId });
  }
}