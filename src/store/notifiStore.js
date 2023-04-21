const { newEvmClient, newEvmConfig } = require('@notifi-network/notifi-frontend-client');
import { signMessageForNotifi } from '../utils/blockchain';

export default {
  namespaced: true,
  state: {
    client: null,
    notifiAuthenticated: null,
    targetGroups: null
  },
  mutations: {
    setClient(state, client) {
      state.client = client;
    },
    setNotifiAuthenticated(state, authenticated) {
      state.notifiAuthenticated = authenticated;
    },
    setTargetGroups(state, targetGroups) {
      state.targetGroups = targetGroups;
    }
  },
  actions: {
    async initNotifiClient({ commit, rootState }) {
      if (!rootState.network.account) return;

      const walletBlockchain = 'AVALANCHE';
      const walletPublicKey = rootState.network.account;
      const tenantId = 'deltaprimenotifidev';
      const blockchainEnv = 'Development';

      const config = newEvmConfig(
        walletBlockchain,
        walletPublicKey,
        tenantId,
        blockchainEnv
      );
      const client = newEvmClient(config);

      if (!client) {
        rootState.progressBarService.emitProgressBarErrorState('Something went wrong with Notifi client setup.');
        return;
      }

      commit('setClient', client);

      // check if user already authenticated
      const initAuthRes = await client.initialize();
      const authenticated = initAuthRes.status === 'authenticated';
      console.log('user notifi authenticated:', authenticated);

      commit('setNotifiAuthenticated', authenticated);

      if (authenticated) {
        // check if user has setup destinations to get alerts
        const targetGroups = await client.getTargetGroups();
        console.log("targetGroups", targetGroups);

        commit('setTargetGroups', targetGroups);
      }
    },
    async initAuth({ state, rootState }) {
      if (state.notifiAuthenticated) {
        console.log('user authenticated by notifi already.');
        return;
      }

      const loginResult = await state.client.logIn({
        walletBlockchain: 'AVALANCHE',
        signMessage: async (message) => {
          const { signedMessage } = await signMessageForNotifi(
            rootState.network.provider,
            message,
            rootState.network.account
          );
          console.log('signedMessage', signedMessage);
          return signedMessage;
        },
      });

      // client should be authenticated now
      console.log('loginResult', loginResult);
    },
    async createTargetGroups({ commit, state, rootState }, { targetPayload }) {
      const targetGroups = await state.client.ensureTargetGroup(targetPayload);
      console.log(targetGroups);

      commit('setTargetGroups', targetGroups);
    },
    async createAlert({ state, rootState }, { eventType, inputs }) {
      const result = await state.client.ensureAlert({
        eventType: {
          type: 'custom',
          sourceType: 'DELTA_PRIME',
          sourceAddress: {
            type: "ref",
            ref: "walletAddress",
          },
          filterOptions: {},
          ...eventType
        },
        inputs: {
          walletAddress: rootState.network.account,
          ...inputs
        },
      });

      console.log(result);
    }
  }
};