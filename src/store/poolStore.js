import {awaitConfirmation, depositTermsToSign, signMessage} from '../utils/blockchain';
import POOL from '@artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import {formatUnits, fromWei, parseUnits} from '@/utils/calculate';
import erc20ABI from '../../test/abis/ERC20.json';
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

    async setupPools({rootState, commit, dispatch}) {
      const provider = rootState.network.provider;
      if (!provider) return;
      const poolsFromConfig = Object.keys(config.POOLS_CONFIG);
      const pools = {};
      poolsFromConfig.forEach(poolAsset => {
        const poolContract = new ethers.Contract(config.POOLS_CONFIG[poolAsset].address, POOL.abi, provider.getSigner());
        Promise.all([
          poolContract.totalSupply(),
          poolContract.balanceOf(rootState.network.account),
          poolContract.getDepositRate(),
          poolContract.getBorrowingRate(),
          poolContract.totalBorrowed(),
          poolContract.getMaxPoolUtilisationForBorrowing(),
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
            interest: deposit * apy / 365,
            maxUtilisation: fromWei(poolDetails[5])
          };
          pools[poolAsset] = pool;
        });
      });
      setTimeout(async () => {
        commit('setPools', pools);
        rootState.serviceRegistry.aprService.emitRefreshApr();
      }, 1000);
    },

    async deposit({state, rootState, commit, dispatch}, {depositRequest}) {
      const provider = rootState.network.provider;

      const tokenContract = new ethers.Contract(config.POOLS_CONFIG[depositRequest.assetSymbol].tokenAddress, erc20ABI, provider.getSigner());
      const decimals = config.ASSETS_CONFIG[depositRequest.assetSymbol].decimals;
      const poolContract = state.pools[depositRequest.assetSymbol].contract;
      const wallet = rootState.network.account;

      if (fromWei(await poolContract.balanceOf(wallet)) === 0) {
        if (!(await signMessage(provider, depositTermsToSign, rootState.network.account, true))) return;
      }

      let depositTransaction;
      if (depositRequest.depositNativeToken) {
        depositTransaction = await poolContract
          .connect(provider.getSigner())
          .depositNativeToken({value: parseUnits(String(depositRequest.amount), decimals)});
      } else {
        const allowance = formatUnits(await tokenContract.allowance(rootState.network.account, poolContract.address), decimals);

        if (parseFloat(allowance) < parseFloat(depositRequest.amount)) {
          let approveTransaction = await tokenContract.connect(provider.getSigner())
              .approve(poolContract.address,
                  parseUnits(String(depositRequest.amount), decimals));

          await awaitConfirmation(approveTransaction, provider, 'approve');
        }

        depositTransaction = await poolContract
          .connect(provider.getSigner())
          .deposit(parseUnits(String(depositRequest.amount), decimals));
      }
      await awaitConfirmation(depositTransaction, provider, 'deposit');
      setTimeout(() => {
        dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(() => {
        dispatch('setupPools');
      }, 30000);
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
        dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(() => {
        dispatch('setupPools');
      }, 30000);
    },
  }
};
