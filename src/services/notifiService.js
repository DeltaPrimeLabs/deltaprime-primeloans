import { Subject } from 'rxjs';
const { newEvmClient, newEvmConfig } = require('@notifi-network/notifi-frontend-client');
import { signMessageForNotifi } from '../utils/blockchain';

export default class notifiService {
  notifi$ = new Subject();
  currentScreen$ = new Subject();
  loadHistory$ = new Subject();

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

  // we call this only once to set up notifi client
  async setupNotifiClient(walletBlockchain, walletPublicKey, tenantId, blockchainEnv) {
    const config = newEvmConfig(
      walletBlockchain,
      walletPublicKey,
      tenantId,
      blockchainEnv
    );
    const client = newEvmClient(config);
    return await this.refreshClientInfo(client);
  }

  async refreshClientInfo(client) {
    // check if user already authenticated by notifi
    const initRes = await client.initialize();
    const authenticated = initRes.status === 'authenticated';
    let data = {};
    let history = {};

    console.log('notifi authenticated:', authenticated);
    if (authenticated) {
      // get user's targets and alerts configured
      data = await client.fetchData();
      history = await this.getNotifications(client);
      console.log("alerts", data.alert);
      console.log("targetGroups", data.targetGroup);
      console.log("history", history);
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
      walletBlockchain: 'AVALANCHE',
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
    console.log('logging in notifi success. loginResult', loginResult);
  }

  async createTargetGroups(client, targetPayload) {
    const targetGroups = await client.ensureTargetGroup(targetPayload);

    return targetGroups;
  }

  async createAnnouncements(client) {
    const eventType = {
      type: 'broadcast',
      name: 'DeltaPrime Announcements',
      broadcastId: {
        type: 'value',
        value: 'deltaprimenotifidev__announcements'
      },
    }
  
    const result = await client.ensureAlert({
      eventType,
      inputs: {},
    });
  
    console.log('createAnnouncements', result);
  }

  /*
  alertFrequency options
  - ALWAYS
  - SINGLE
  - QUARTER_HOUR
  - HOURLY
  - DAILY
  */

  async createLiquidationAlerts(client, walletAddress) {
    const eventType = {
      type: "custom",
      name: "Liquidation Alerts",
      sourceType: "DELTA_PRIME",
      filterType: "LIQUIDATIONS",
      sourceAddress: {
        type: "ref",
        ref: "walletAddress",
      },
      selectedUIType: "TOGGLE",
      filterOptions: {},
    };
  
    const result = await client.ensureAlert({
      eventType,
      inputs: {
        walletAddress,
      },
    });
  
    console.log('createLiquidationAlerts', result);
  }

  async createLoanHealthAlerts(client, walletAddress, healthRatio) {
    const eventType = {
      type: 'custom',
      name: 'Loan Health Alerts',
      sourceType: 'DELTA_PRIME',
      filterType: 'DELTA_PRIME_LENDING_HEALTH_EVENTS',
      sourceAddress: {
        type: "ref",
        ref: "walletAddress",
      },
      selectedUIType: "HEALTH_CHECK",
      alertFrequency: 'DAILY',
      checkRatios: [{ type: 'below', value: 100 }],
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

  async createBorrowRateAlerts(client, poolAddress, thresholdDirection, threshold) {
    const name = `Borrow Rate Alerts: ${poolAddress} ${thresholdDirection} ${threshold}`;
    const eventType = {
      type: 'custom',
      name,
      sourceType: 'DELTA_PRIME_LENDING_RATES',
      filterType: 'DELTA_PRIME_BORROW_RATE_EVENTS',
      sourceAddress: {
        type: "value",
        value: poolAddress,
      },
      selectedUIType: "TOGGLE",
      filterOptions: {
        alertFrequency: 'DAILY',
        threshold,
        thresholdDirection,
      },
    }

    const result = await client.ensureAlert({
      eventType,
      inputs: {},
    });

    console.log('createBorrowRateAlerts', result);
  }

  async createLendingRateAlerts(client, poolAddress, thresholdDirection, threshold) {
    const name = `Lending Rate Alerts: ${poolAddress} ${thresholdDirection} ${threshold}`;
    const eventType = {
      type: 'custom',
      name,
      sourceType: 'DELTA_PRIME_LENDING_RATES',
      filterType: 'DELTA_PRIME_SUPPLY_RATE_EVENTS',
      sourceAddress: {
        type: "value",
        value: poolAddress,
      },
      selectedUIType: "TOGGLE",
      filterOptions: {
        alertFrequency: 'DAILY',
        threshold,
        thresholdDirection,
      },
    }

    const result = await client.ensureAlert({
      eventType,
      inputs: {},
    });

    console.log('createLendingRateAlerts', result);
  }

  deleteAlert(client, alertId) {
    client.deleteAlert({ id: alertId });
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

  async deletAlert(client, id) {
    await client.deleteAlert({ id });
  }
}