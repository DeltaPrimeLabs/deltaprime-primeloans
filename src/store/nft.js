import {Contract} from "ethers";
import NFT from '@contracts/BorrowAccessNFT.json'
import {parseArweaveURI} from "../utils/blockchain";
import config from "@/config";

export default {
  namespaced: true,
  state: {
    borrowNftContract: null,
    borrowNftId: null,
    borrowNftImageUri: null,
    depositNftContract: null,
    depositNftId: null,
    depositNftImageUri: null
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
    setDepositNftContract(state, contract) {
      state.depositNftContract = contract;
    },
    setDepositNftId(state, id) {
      state.depositNftId = id;
    },
    setDepositNftImageUri(state, uri) {
      state.depositNftImageUri = uri;
    },
  },
  getters: {
    hasBorrowNft(state) {
      return state.borrowNftId !== null;
    },
    borrowingLocked(state) {
      return config.borrowNftAddress && state.borrowNftId === null;
    },
    hasDepositNft(state) {
      return state.depositNftId !== null;
    },
    depositLocked(state) {
      return config.depositNftAddress && state.depositNftId === null;
    }
  },
  actions: {
    async initNfts({ commit, dispatch }) {
      if (config.borrowNftAddress) {
        const borrowContract = new Contract(config.borrowNftAddress, NFT.abi, provider.getSigner());

        commit('setBorrowNftContract', borrowContract);
        dispatch('getBorrowNftId');
      }

      if (config.depositNftAddress) {
        const depositContract = new Contract(config.depositNftAddress, NFT.abi, provider.getSigner());

        commit('setDepositNftContract', depositContract);
        dispatch('getDepositNftId');
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
      const balance = (await state.borrowNftContract.balanceOf(rootState.network.account)).toNumber();
      if (balance > 0) {
        const id = (await state.borrowNftContract.tokenOfOwnerByIndex(rootState.network.account, 0)).toNumber();

        commit('setBorrowNftId', id);
        dispatch('updateBorrowNftFromId', {id: id})
      }
    }
  }
};
