import {Contract} from "ethers";
const ethers = require('ethers');
import BORROW_NFT from '@artifacts/contracts/ERC721/BorrowAccessNFT.sol/BorrowAccessNFT.json'
import DEPOSIT_NFT from '@artifacts/contracts/ERC721/DepositAccessNFT.sol/DepositAccessNFT.json'
const FACTORY_TUP = require('@contracts/SmartLoansFactoryTUP.json');
const POOL_TUP = require('@contracts/PoolTUP.json');
import FACTORY_NFT from '@artifacts/contracts/upgraded/SmartLoansFactoryWithAccessNFT.sol/SmartLoansFactoryWithAccessNFT.json'
import POOL_NFT from '@artifacts/contracts/upgraded/PoolWithAccessNFT.sol/PoolWithAccessNFT.json'
import {awaitConfirmation} from "../utils/blockchain";
const ZERO = ethers.constants.AddressZero;

export default {
  namespaced: true,
  state: {
    borrowNftContract: null,
    borrowNftContractSet: true,
    hasBorrowNft: null,
    borrowNftId: null,
    borrowNftImageUri: null,
    depositNftContract: null,
    depositNftContractSet: true,
    hasDepositNft: null,
    depositNftId: null,
    depositNftImageUri: null
  },
  mutations: {
    setBorrowNftContract(state, contract) {
      state.borrowNftContract = contract;
    },
    setBorrowNftContractSet(state, has) {
      state.borrowNftContractSet = has;
    },
    setBorrowNftId(state, id) {
      state.borrowNftId = id;
    },
    setHasBorrowNft(state, has) {
      state.hasBorrowNft = has;
    },
    setBorrowNftImageUri(state, uri) {
      state.borrowNftImageUri = uri;
    },
    setDepositNftContract(state, contract) {
      state.depositNftContract = contract;
    },
    setDepositNftContractSet(state, has) {
      state.depositNftContractSet = has;
    },
    setDepositNftId(state, id) {
      state.depositNftId = id;
    },
    setHasDepositNft(state, has) {
      state.hasDepositNft = has;
    },
    setDepositNftImageUri(state, uri) {
      state.depositNftImageUri = uri;
    },
  },
  getters: {
    borrowingLocked(state) {
      return state.borrowNftContractSet && state.borrowNftId === null;
    },
    depositLocked(state) {
      return state.depositNftContractSet && state.depositNftId === null;
    }
  },
  actions: {
    async initNfts({ commit, dispatch, rootState }) {
      const provider = rootState.network.provider;

      try {
        const factory = new Contract(FACTORY_TUP.address, FACTORY_NFT.abi, provider.getSigner());
        factory.iface = new ethers.utils.Interface(FACTORY_NFT.abi);

        const address = await factory.getAccessNFT();
        //TODO: simplify
        commit('setBorrowNftContractSet', address !== ZERO);

        const borrowContract = new Contract(address, BORROW_NFT.abi, provider.getSigner());

        commit('setBorrowNftContract', borrowContract);
        dispatch('getBorrowNftId');
      } catch(e) {
        console.error(e)
        console.log('No access NFT for borrow required')
        commit('setBorrowNftContractSet', false);
      }

      try {
        const pool = new Contract(POOL_TUP.address, POOL_NFT.abi, provider.getSigner());
        const address = await pool.getAccessNFT();
        commit('setDepositNftContractSet', address !== ZERO);

        const depositContract = new Contract(address, DEPOSIT_NFT.abi, provider.getSigner());

        commit('setDepositNftContract', depositContract);
        dispatch('getDepositNftId');
      } catch(e) {
        console.error(e)
        console.log('No access NFT for deposit required')
        commit('setDepositNftContractSet', false);
      }
    },
    async updateBorrowNftFromId({ commit, state }, { id }) {
      const jsonUri = await state.borrowNftContract.tokenURI(id);
      const response = await fetch(jsonUri);
      const json = await response.json();
      const uri = json.image;

      commit('setBorrowNftImageUri', uri);
    },
    async updateDepositNftFromId({ commit, state }, { id }) {
      const jsonUri = await state.depositNftContract.tokenURI(id);
      const response = await fetch(jsonUri);
      const json = await response.json();
      const uri = json.image;

      commit('setDepositNftImageUri', uri);
    },
    async getBorrowNftId({ state, rootState, dispatch, commit }) {
      const balance = (await state.borrowNftContract.balanceOf(rootState.network.account)).toNumber();
      if (balance > 0) {
        const id = (await state.borrowNftContract.tokenOfOwnerByIndex(rootState.network.account, 0)).toNumber();

        commit('setHasBorrowNft', true);
        commit('setBorrowNftId', id);
        dispatch('updateBorrowNftFromId', {id: id})
      } else {
        commit('setHasBorrowNft', false);
      }
    },
    async getDepositNftId({ state, rootState, dispatch, commit }) {
      const balance = (await state.depositNftContract.balanceOf(rootState.network.account)).toNumber();

      if (balance > 0) {
        const id = (await state.depositNftContract.tokenOfOwnerByIndex(rootState.network.account, 0)).toNumber();

        commit('setHasDepositNft', true);
        commit('setDepositNftId', id);
        dispatch('updateDepositNftFromId', {id: id})
      } else {
        commit('setHasDepositNft', false);
      }
    },
    async mintBorrowNft({ dispatch, state, rootState }, {id, signature}) {
      const provider = rootState.network.provider;
      let tx = await state.borrowNftContract.safeMint(id, signature);

      await awaitConfirmation(tx, provider, 'mint');

      dispatch('getBorrowNftId', {id: id})
    },
    async mintDepositNft({ dispatch, state, rootState }, {id, signature}) {
      const provider = rootState.network.provider;
      let tx = await state.depositNftContract.safeMint(id, signature);

      await awaitConfirmation(tx, provider, 'mint');

      dispatch('getDepositNftId', {id: id})
    }
  }
};
