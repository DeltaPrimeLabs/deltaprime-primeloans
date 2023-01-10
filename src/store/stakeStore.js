import {awaitConfirmation, wrapContract} from '../utils/blockchain';
import config from '../config';
import {parseUnits} from 'ethers/lib/utils';
import {BigNumber} from 'ethers';
import {mergeArrays} from '../utils/calculate';

const fromBytes32 = require('ethers').utils.parseBytes32String;


export default {
  namespaced: true,
  state: {
    farms: config.FARMED_TOKENS_CONFIG,
  },
  mutations: {
    setFarms(state, farms) {
      state.farms = farms;
    },
  },
  actions: {

    async stakeStoreSetup({dispatch}) {
    },

    //TODO: stakeRequest
    async stake({state, rootState, dispatch, commit}, {stakeRequest}) {

      const provider = rootState.network.provider;
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      let assets = [
        (await smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ];

      if (stakeRequest.symbol) assets.push([stakeRequest.symbol]);

      const loanAssets = mergeArrays(assets);

      const stakeTransaction = await (await wrapContract(smartLoanContract, loanAssets))[stakeRequest.method]
      (
        parseUnits(String(stakeRequest.amount),
          BigNumber.from(stakeRequest.decimals.toString())),
        {gasLimit: stakeRequest.gas ? stakeRequest.gas : 8000000}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar(stakeRequest.refreshDelay);
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(stakeTransaction, provider, 'stake');
      setTimeout(async () => {
        await dispatch('fundsStore/updateFunds', {}, {root: true});
      }, stakeRequest.refreshDelay);
    },

    async unstake({state, rootState, dispatch, commit}, {unstakeRequest}) {
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      const loanAssets = mergeArrays([(
        await smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        unstakeRequest.rewardTokens,
        unstakeRequest.asset,
        Object.keys(config.POOLS_CONFIG)
      ]);

      const unstakeTransaction = unstakeRequest.minAmount ?
        await (await wrapContract(smartLoanContract, loanAssets))[unstakeRequest.method](
          parseUnits(parseFloat(unstakeRequest.amount).toFixed(unstakeRequest.decimals), BigNumber.from(unstakeRequest.decimals.toString())),
          parseUnits(parseFloat(unstakeRequest.minAmount).toFixed(unstakeRequest.decimals), BigNumber.from(unstakeRequest.decimals.toString())),
          {gasLimit: unstakeRequest.gas ? unstakeRequest.gas : 8000000})
        :
        await (await wrapContract(smartLoanContract, loanAssets))[unstakeRequest.method](
            parseUnits(parseFloat(unstakeRequest.amount).toFixed(unstakeRequest.decimals), BigNumber.from(unstakeRequest.decimals.toString())),
            {gasLimit: unstakeRequest.gas ? unstakeRequest.gas : 8000000});

      rootState.serviceRegistry.progressBarService.requestProgressBar(unstakeRequest.refreshDelay);
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(unstakeTransaction, provider, 'unstake');

      setTimeout(async () => {
        await dispatch('fundsStore/updateFunds', {}, {root: true});
      }, unstakeRequest.refreshDelay);
    },

    async updateStakedBalances({rootState, state, commit}) {
      let farms = state.farms;

      for (const [symbol, tokenFarms] of Object.entries(config.FARMED_TOKENS_CONFIG)) {
        for (let farm of tokenFarms) {
          const totalStaked = await farm.staked(rootState.fundsStore.smartLoanContract.address);
          farm.totalStaked = totalStaked;
        }
      }

      commit('setFarms', farms);
    },

    async updateStakedPrices({state, rootState, commit}) {
      let farms = state.farms;
      for (const [symbol, tokenFarms] of Object.entries(farms)) {
        const asset = rootState.fundsStore.assets[symbol] ?
            rootState.fundsStore.assets[symbol]
            :
            rootState.fundsStore.lpAssets[symbol];

        if (asset) {
          for (let farm of tokenFarms) {
            farm.price = asset.price;
          }
        }
      }
      commit('setFarms', farms);
    },
  }
};
