import {awaitConfirmation, erc20ABI} from '../utils/blockchain';
import POOL from '@artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import {formatUnits, fromWei, parseUnits} from '@/utils/calculate';
import config from '@/config';


const ethers = require('ethers');

export default {
  namespaced: true,
  state: {
    poolContract: null,
    usdcPoolContract: null,
    avaxPool: null,
    usdcPool: null,
    pools: null,
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

    setPools(state, pools) {
      state.pools = pools;
    },
  },
  actions: {

    async poolStoreSetup({dispatch}) {
      await dispatch('setupPools');
    },

    async setupPools({rootState, commit}) {
      const provider = rootState.network.provider;
      const poolsFromConfig = Object.keys(config.POOLS_CONFIG);
      const pools = {};
      poolsFromConfig.forEach(poolAsset => {
        const poolContract = new ethers.Contract(config.POOLS_CONFIG[poolAsset].address, POOL.abi, provider.getSigner());
        Promise.all([
          poolContract.totalSupply(),
          poolContract.balanceOf(rootState.network.account),
          poolContract.getDepositRate(),
          poolContract.getBorrowingRate(),
          poolContract.totalBorrowed()
        ]).then(poolDetails => {

          const deposit = formatUnits(String(poolDetails[1]), config.ASSETS_CONFIG[poolAsset].decimals);
          const apy = fromWei(poolDetails[2]);

          const pool = {
            asset: config.ASSETS_CONFIG[poolAsset],
            contract: poolContract,
            tvl: formatUnits(String(poolDetails[0]), config.ASSETS_CONFIG[poolAsset].decimals),
            deposit: deposit,
            apy: apy,
            borrowingAPY: fromWei(poolDetails[3]),
            totalBorrowed: formatUnits(String(poolDetails[4]), config.ASSETS_CONFIG[poolAsset].decimals),
            interest: deposit * apy / 365
          };
          pools[poolAsset] = pool;
        });
      });
      setTimeout(() => {
        commit('setPools', pools);
      }, 1000);
    },

    async deposit({state, rootState, commit, dispatch}, {depositRequest}) {
      const provider = rootState.network.provider;

      const tokenContract = new ethers.Contract(config.POOLS_CONFIG[depositRequest.assetSymbol].tokenAddress, erc20ABI, provider.getSigner());

      let depositTransaction;
      if (depositRequest.depositNativeToken) {
        depositTransaction = await state.pools[depositRequest.assetSymbol].contract
          .connect(provider.getSigner())
          .depositNativeToken({value: parseUnits(String(depositRequest.amount), config.ASSETS_CONFIG[depositRequest.assetSymbol].decimals)});
      } else {
        await tokenContract.connect(provider.getSigner())
          .approve(state.pools[depositRequest.assetSymbol].contract.address,
            parseUnits(String(depositRequest.amount), config.ASSETS_CONFIG[depositRequest.assetSymbol].decimals));
        depositTransaction = await state.pools[depositRequest.assetSymbol].contract
          .connect(provider.getSigner())
          .deposit(parseUnits(String(depositRequest.amount), config.ASSETS_CONFIG[depositRequest.assetSymbol].decimals));
      }
      await awaitConfirmation(depositTransaction, provider, 'deposit');
      setTimeout(() => {
        dispatch('setupPools');
        dispatch('network/updateBalance', {}, {root: true});
      }, 1000);
    },

    async withdraw({state, rootState, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;
      let withdrawTransaction;
      if (withdrawRequest.withdrawNativeToken) {
        withdrawTransaction = await state.pools[withdrawRequest.assetSymbol].contract.connect(provider.getSigner())
          .withdrawNativeToken(
            parseUnits(String(withdrawRequest.amount),
              config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals));
      } else {
        withdrawTransaction = await state.pools[withdrawRequest.assetSymbol].contract.connect(provider.getSigner())
          .withdraw(
            parseUnits(String(withdrawRequest.amount),
              config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals));
      }
      await awaitConfirmation(withdrawTransaction, provider, 'deposit');

      setTimeout(() => {
        dispatch('setupPools');
        dispatch('network/updateBalance', {}, {root: true});
      }, 1000);
    },
  }
};
