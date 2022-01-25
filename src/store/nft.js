import {Contract} from "ethers";
import NFT from '@contracts/BorrowAccessNft.json'
import {parseArweaveURI} from "../utils/blockchain";

export default {
  namespaced: true,
  state: {
    borrowNftContract: null,
    borrowNftId: null,
    borrowNftImageUri: null
  },
  mutations: {
    setBorrowNftContract(state, contract) {
      state.borrowNftContract = contract;
    },
    setBorrowNftId(state, id) {
      state.borrowNftId = id;
    },
    setBorrowNftImageUri(state, uri) {
      state.borrowNftImageUri = uri;
    },
  },
  getters: {
    hasBorrowNft(state) {
      return state.borrowNftId !== null;
    }
  },
  actions: {
    async initNfts({ commit, rootState, dispatch }) {
      const contract = new Contract(NFT.networks[rootState.network.chainId].address, NFT.abi, provider.getSigner());
      commit('setBorrowNftContract', contract);

      const balance = (await contract.balanceOf(rootState.network.account)).toNumber();
      if (balance > 0) {
        dispatch('getBorrowNftId')
      }
    },
    async updateBorrowNftFromId({ commit, state }, { id }) {
      const jsonUri = parseArweaveURI(await state.borrowNftContract.tokenURI(id));
      const response = await fetch(jsonUri);
      const json = await response.json();
      const uri = parseArweaveURI(json.image);
      commit('setBorrowNftImageUri', uri);
    },
    async getBorrowNftId({ state, rootState, dispatch, commit }) {
      const id = (await state.borrowNftContract.tokenOfOwnerByIndex(rootState.network.account, 0)).toNumber();

      commit('setBorrowNftId', id);
      dispatch('updateBorrowNftFromId', { id: id })
    }
  },
};
