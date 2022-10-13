import {awaitConfirmation} from '../utils/blockchain';
import {toWei} from '@/utils/calculate';
import config from "../config";
import {parseUnits} from "ethers/lib/utils";
import {BigNumber} from "ethers";


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
    async stake({state, rootState, dispatch, commit}, {method, amount, decimals}) {

      const provider = rootState.network.provider;
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      const stakeTransaction = await smartLoanContract[method](parseUnits(String(amount), BigNumber.from(decimals.toString())), {gasLimit: 110000000});

      await awaitConfirmation(stakeTransaction, provider, method);

      await dispatch('updateStakedBalances');
      await dispatch('network/updateBalance', {}, {root: true})
    },

    async unstake({state, rootState, dispatch, commit}, {method, amount, decimals}) {
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      const unstakeTransaction = await smartLoanContract[method](parseUnits(String(amount), BigNumber.from(decimals.toString())), {gasLimit: 1100000});
      await awaitConfirmation(unstakeTransaction, provider, method)

      await dispatch('updateStakedBalances');
      await dispatch('network/updateBalance', {}, {root: true})
    },

    async updateStakedBalances({rootState, commit}) {
     //TODO:
    },
  }
}
