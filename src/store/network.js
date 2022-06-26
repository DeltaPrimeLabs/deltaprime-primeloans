const ethers = require('ethers');
let ethereum = window.ethereum;
import Vue from "vue";
import redstone from 'redstone-api';

export default {
  namespaced: true,
  state: {
    provider: null,
    account: null,
    balance: null,
    avaxPrice: null
  },
  mutations: {
    setProvider(state, provider) {
      state.provider = provider;
    },
    setAccount(state, account) {
      state.account = account;
    },
    setBalance(state, balance) {
      state.balance = balance;
    },
    setAvaxPrice(state, price) {
      state.avaxPrice = price;
    }
  },
  getters: {
  },
  actions: {
    async initNetwork({ dispatch }) {
      //TODO: Promise.all?
      await dispatch('initProvider');
      await dispatch('initAccount');
      await dispatch('updateBalance');
      await dispatch('updateAvaxPrice');
    },
    async initProvider({ commit }) {
      await ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      window.provider = provider;

      console.log(provider);
      commit('setProvider', provider);
    },
    async initAccount({ commit, state }) {
      if (state.account) {
        return state.account;
      }

      let provider = state.provider;
      let accounts = await provider.listAccounts();

      if (accounts.length > 0) {
        const mainAccount = accounts[0];
        commit('setAccount', mainAccount);
      } else {
        Vue.$toast.error("No accounts available");
      }
    },
    async updateBalance({ state, commit }) {
      const mainAccount = state.account;
      const balance = parseFloat(ethers.utils.formatEther(await state.provider.getBalance(mainAccount)));

      commit('setBalance', balance);
    },
    async updateAvaxPrice({ commit }) {
      const avaxPrice = (await redstone.getPrice("AVAX", { provider: 'redstone-avalanche'})).value;
      commit('setAvaxPrice', avaxPrice);
    }
  },
};
