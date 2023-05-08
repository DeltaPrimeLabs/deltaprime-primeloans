// const { newEvmClient, newEvmConfig } = require('@notifi-network/notifi-frontend-client');
// import { signMessageForNotifi } from '../utils/blockchain';

export default {
  namespaced: true,
  state: {
    notifi: null,
  },
  mutations: {
    setNotifi(state, notifi) {
      state.notifi = notifi;
    },
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
    }
  }
};