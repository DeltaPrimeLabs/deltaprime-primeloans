import notifiConfig from "../components/notifi/notifiConfig";

export default {
  namespaced: true,
  state: {
    notifi: null,
    alertSettings: null
  },
  mutations: {
    setNotifi(state, notifi) {
      state.notifi = notifi;
    },
    setAlertSettings(state, settings) {
      state.alertSettings = settings;
    }
  },
  actions: {
    notifiStoreSetup({ dispatch }) {
      dispatch('setupNotifi');
    },

    async setupNotifi({ commit, rootState }) {
      if (!rootState.network.account) return;

      const notifiService = rootState.serviceRegistry.notifiService;

      const walletBlockchain = 'AVALANCHE';
      const walletPublicKey = rootState.network.account;
      const tenantId = 'deltaprimenotifidev';
      const blockchainEnv = 'Development';

      const notifi = await notifiService.setupNotifiClient(walletBlockchain, walletPublicKey, tenantId, blockchainEnv);

      commit('setNotifi', notifi);

      const alertSettings = notifiConfig.ALERTS_CONFIG;

      for (const alert of notifi.alerts) {
        alertSettings[alert.filter.filterType]['id'] = alert.id;
        alertSettings[alert.filter.filterType]['created'] = true;
        if (alert.filter.filterType === 'DELTA_PRIME_BORROW_RATE_EVENTS') {
          // we can have multiple borrow rate alerts with differnt thresholds
          if (!alertSettings[alert.filter.filterType]['filterOptions']) alertSettings[alert.filter.filterType]['filterOptions'] = [];
          alertSettings[alert.filter.filterType]['filterOptions'].push({
            ...JSON.parse(alert.filterOptions),
            poolAddress: alert.sourceGroup.sources[0].blockchainAddress
          });
        } else {
          alertSettings[alert.filter.filterType]['filterOptions'] = JSON.parse(alert.filterOptions);
        }
      }

      commit('setAlertSettings', alertSettings)
    },

    async handleCreateAlert({ commit, rootState, state }, { alert, payload }) {
      const notifiService = rootState.serviceRegistry.notifiService;
      const alertSettings = state.alertSettings;

      alertSettings[alert.alertType]['created'] = alert.toggle;
      commit('setAlertSettings', alertSettings);

      if (!alert.toggle) {
        notifiService.deleteAlert(state.notifi.client, alert.alertId);
      } else {
        const alertRes = await notifiService[alertSettings[alert.alertType].createMethod](payload);
        console.log(alertRes);

        alertSettings[alert.alertType]['id'] = alertRes.id;
        alertSettings[alert.alertType]['filterOptions'] = JSON.parse(alertRes.filterOptions);

        commit('setAlertSettings', alertSettings);
      }
    }
  }
};