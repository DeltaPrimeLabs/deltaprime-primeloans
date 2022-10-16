import {awaitConfirmation} from '../utils/blockchain';
import {toWei} from '@/utils/calculate';
import config from '../config';
import {parseUnits} from 'ethers/lib/utils';
import {BigNumber} from 'ethers';


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
    async stake({state, rootState, dispatch, commit}, {stakeRequest}) {

      const provider = rootState.network.provider;
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      const stakeTransaction = await smartLoanContract[stakeRequest.method]
      (
        parseUnits(String(stakeRequest.amount),
          BigNumber.from(stakeRequest.decimals.toString())),
        {gasLimit: 110000000}
      );

      await awaitConfirmation(stakeTransaction, provider, stakeRequest.method);

      await dispatch('updateStakedBalances');
      await dispatch('network/updateBalance', {}, {root: true});
    },

    async unstake({state, rootState, dispatch, commit}, {unstakeRequest}) {
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      const unstakeTransaction = await smartLoanContract[unstakeRequest.method](parseUnits(String(unstakeRequest.amount), BigNumber.from(unstakeRequest.decimals.toString())), {gasLimit: 1100000});
      await awaitConfirmation(unstakeTransaction, provider, unstakeRequest.method);

      await dispatch('updateStakedBalances');
      await dispatch('network/updateBalance', {}, {root: true});
    },

    async updateStakedBalances({rootState, commit}) {

    },
  }
};
