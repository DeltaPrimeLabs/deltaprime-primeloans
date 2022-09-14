import {awaitConfirmation, handleCall} from '../utils/blockchain';
import SMART_LOAN from '@contracts/SmartLoanLogicFacet.json';
import SMART_LOAN_FACTORY_TUP from '@contracts/SmartLoansFactoryTUP.json';
import SMART_LOAN_FACTORY from '@contracts/SmartLoansFactory.json';
import PANGOLIN_EXCHANGETUP from '@contracts/PangolinExchangeTUP.json';
import PANGOLIN_EXCHANGE from '@artifacts/contracts/PangolinExchange.sol/PangolinExchange.json';
import EXCHANGE from '@artifacts/contracts/PangolinExchange.sol/PangolinExchange.json';
import POOL from '@artifacts/contracts/WavaxPool.sol/WavaxPool.json';
import USDC_POOL from '@artifacts/contracts/UsdcPool.sol/UsdcPool.json';
import POOL_TUP from '@contracts/WavaxPoolTUP.json';
import USDC_POOL_TUP from '@contracts/UsdcPoolTUP.json';
import {formatUnits, fromWei, parseUnits, round, toWei} from '@/utils/calculate';
import config from '@/config';
import {acceptableSlippage, maxAvaxToBeSold, minAvaxToBeBought, parseLogs} from '../utils/calculate';
import {WrapperBuilder} from 'redstone-evm-connector';
import {fetchCollateralFromPayments, fetchEventsForSmartLoan} from '../utils/graph';
import redstone from 'redstone-api';
import {BigNumber} from 'ethers';
import {from} from 'apollo-boost';


const toBytes32 = require('ethers').utils.formatBytes32String;

const ethers = require('ethers');

const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function totalSupply() public view returns (uint256 supply)',
  'function totalDeposits() public view returns (uint256 deposits)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)'
];

const wavaxAbi = [
  'function deposit() public payable',
  ...erc20ABI
];

export default {
  namespaced: true,
  state: {
    poolContract: null,
    usdcPoolContract: null,
    avaxPool: null,
    usdcPool: null,
  },
  getters: {},
  mutations: {
    setPoolContract(state, poolContract) {
      state.poolContract = poolContract;
    },

    setUsdcPoolContract(state, poolContract) {
      state.usdcPoolContract = poolContract;
    },

    setAvaxPool(state, pool) {
      state.avaxPool = pool;
    },

    setUsdcPool(state, pool) {
      state.usdcPool = pool;
    },
  },
  actions: {

    async poolStoreSetup({dispatch}) {
      await dispatch('setupPoolContract');
      await dispatch('setupPool');
      await dispatch('setupUsdcPoolContract');
      await dispatch('setupUsdcPool');
    },

    async setupPoolContract({rootState, commit}) {
      const provider = rootState.network.provider;
      const poolContract = new ethers.Contract(POOL_TUP.address, POOL.abi, provider.getSigner());
      commit('setPoolContract', poolContract);
    },

    async setupUsdcPoolContract({rootState, commit}) {
      const provider = rootState.network.provider;
      const poolContract = new ethers.Contract(USDC_POOL_TUP.address, USDC_POOL.abi, provider.getSigner());
      console.log(poolContract);
      commit('setUsdcPoolContract', poolContract);
    },

    async setupPool({state, rootState, commit}) {
      const tvl = await state.poolContract.totalSupply();
      const deposit = await state.poolContract.balanceOf(rootState.network.account);
      const depositAPY = await state.poolContract.getDepositRate();
      const borrowingAPY = await state.poolContract.getBorrowingRate();

      const pool = {
        tvl: fromWei(tvl),
        deposit: fromWei(deposit),
        apy: fromWei(depositAPY),
        borrowingAPY: fromWei(borrowingAPY)
      };
      console.log(pool);
      commit('setAvaxPool', pool);
    },

    async setupUsdcPool({state, rootState, commit}) {
      const tvl = await state.usdcPoolContract.totalSupply();
      const deposit = await state.usdcPoolContract.balanceOf(rootState.network.account);
      const depositAPY = await state.usdcPoolContract.getDepositRate();
      const borrowingAPY = await state.usdcPoolContract.getBorrowingRate();

      const pool = {
        tvl: fromWei(tvl),
        deposit: fromWei(deposit),
        apy: fromWei(depositAPY),
        borrowingAPY: fromWei(borrowingAPY)
      };
      commit('setUsdcPool', pool);
    },

    async deposit({state, rootState, commit, dispatch}, {amount}) {
      const provider = rootState.network.provider;

      const wavaxTokenContract = rootState.fundsStore.wavaxTokenContract;

      await wavaxTokenContract.connect(provider.getSigner()).approve(state.poolContract.address, toWei(String(amount)));
      const depositTransaction = await state.poolContract.connect(provider.getSigner()).deposit(toWei(String(amount)));
      await awaitConfirmation(depositTransaction, provider, 'deposit');
      await dispatch('setupPool');
    },

    async depositUsdc({state, rootState, commit, dispatch}, {amount}) {
      const provider = rootState.network.provider;

      const usdcTokenContract = rootState.fundsStore.usdcTokenContract;

      await usdcTokenContract.connect(provider.getSigner()).approve(state.usdcPoolContract.address, toWei(String(amount)));
      await state.poolContract.connect(provider.getSigner()).deposit(toWei(String(amount)));

      await dispatch('setupUsdcPool');
    },

    async withdraw({state, rootState, commit, dispatch}, {amount}) {
      const provider = rootState.network.provider;

      await state.poolContract.connect(provider.getSigner()).withdraw(toWei(String(amount)));

      await dispatch('setupPool');
    },

    async withdrawUsdc({state, rootState, commit, dispatch}, {amount}) {
      const provider = rootState.network.provider;

      await state.usdcPoolContract.connect(provider.getSigner()).withdraw(parseUnits(String(amount), config.ASSETS_CONFIG['USDC'].decimals));

      await dispatch('setupUsdcPool');
    },
  },
}
