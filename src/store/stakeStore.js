import {awaitConfirmation} from '../utils/blockchain';
import {toWei} from '@/utils/calculate';
import config from "../config";


export default {
  namespaced: true,
  state: {
    stakedAssets: null,
  },
  getters: {
    getStakedAssets(state) {
      return state.stakedAssets;
    }
  },
  mutations: {
    setStakedAssets(state, stakedAssets) {
      state.stakedAssets = stakedAssets;
    },
  },
  actions: {

    async stakeStoreSetup({dispatch}) {
      await dispatch('updateStakedBalances');
    },

    //TODO: stakeRequest
    async stake({state, rootState, dispatch, commit}, {method, amount}) {

      const provider = rootState.network.provider;
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      const stakeTransaction = await smartLoanContract[method](toWei(String(amount)), {gasLimit: 110000000});

      await awaitConfirmation(stakeTransaction, provider, method);

      await dispatch('updateStakedBalances');
      await dispatch('network/updateBalance', {}, {root: true})
    },

    async unstake({state, rootState, dispatch, commit}, {method, amount}) {
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      const unstakeTransaction = await smartLoanContract[method](amount, {gasLimit: 1100000});
      await awaitConfirmation(unstakeTransaction, provider, method)

      await dispatch('updateStakedBalances');
      await dispatch('network/updateBalance', {}, {root: true})
    },

    async updateStakedBalances({rootState, commit}) {
     //TODO:
    },
  }
}
