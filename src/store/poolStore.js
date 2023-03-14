import { awaitConfirmation, depositTermsToSign, signMessage } from '../utils/blockchain';
import POOL from '@artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import { formatUnits, fromWei, parseUnits } from '@/utils/calculate';
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

    async poolStoreSetup({ dispatch }) {
      await dispatch('setupPools');
    },

    async setupPools({ rootState, commit }) {
      const poolService = rootState.serviceRegistry.poolService;

      const redstonePriceDataRequest = await fetch('https://oracle-gateway-1.a.redstone.finance/data-packages/latest/redstone-avalanche-prod');
      const redstonePriceData = await redstonePriceDataRequest.json();

      await poolService.setupPools(rootState.network.provider, rootState.network.account, redstonePriceData)
        .subscribe(pools => {
          poolService.emitPools(pools);
          commit('setPools', pools);
        });
    },

    async deposit({ state, rootState, commit, dispatch }, { depositRequest, isCallStatic }) {
      const provider = rootState.network.provider;

      const tokenContract = new ethers.Contract(config.POOLS_CONFIG[depositRequest.assetSymbol].tokenAddress, erc20ABI, provider.getSigner());
      const decimals = config.ASSETS_CONFIG[depositRequest.assetSymbol].decimals;
      const poolContract = state.pools.find(pool => pool.asset.symbol === depositRequest.assetSymbol).contract;
      const wallet = rootState.network.account;

      if (fromWei(await poolContract.balanceOf(wallet)) === 0) {
        if (!(await signMessage(provider, depositTermsToSign, rootState.network.account, true))) return;
      }

      let depositTransaction;
      if (depositRequest.depositNativeToken) {
        try {
          if (isCallStatic) {
            console.log('calling function through callStatic...')
            const tx = await poolContract
              .connect(provider.getSigner())
              .callStatic
              .depositNativeToken({ value: parseUnits(String(depositRequest.amount), decimals) });
            console.log(tx);
            if (tx.code || tx.errorName || tx.errorSignature) return true;
          }
        } catch (error) {
          console.log("callStatic to deposit AVAX error: ", error);
        }

        depositTransaction = await poolContract
          .connect(provider.getSigner())
          .depositNativeToken({ value: parseUnits(String(depositRequest.amount), decimals) });
      } else {
        const allowance = formatUnits(await tokenContract.allowance(rootState.network.account, poolContract.address), decimals);

        if (parseFloat(allowance) < parseFloat(depositRequest.amount)) {
          let approveTransaction = await tokenContract.connect(provider.getSigner())
            .approve(poolContract.address,
              parseUnits(String(depositRequest.amount), decimals), { gasLimit: 100000 });

          await awaitConfirmation(approveTransaction, provider, 'approve');
        }

        try {
          if (isCallStatic) {
            console.log('calling function through callStatic...')
            const tx = await poolContract
              .connect(provider.getSigner())
              .callStatic
              .deposit(parseUnits(String(depositRequest.amount), decimals));
            console.log(tx);
            if (tx.code || tx.errorName || tx.errorSignature) return true;
          }
        } catch (error) {
          console.log("callStatic to deposit error: ", error);
        }

        depositTransaction = await poolContract
          .connect(provider.getSigner())
          .deposit(parseUnits(String(depositRequest.amount), decimals));
      }
      await awaitConfirmation(depositTransaction, provider, 'deposit');
      setTimeout(() => {
        dispatch('network/updateBalance', {}, { root: true });
      }, 1000);

      setTimeout(() => {
        dispatch('setupPools');
      }, 30000);
    },

    async withdraw({ state, rootState, dispatch }, { withdrawRequest, isCallStatic }) {
      const provider = rootState.network.provider;
      let withdrawTransaction;
      const pool = state.pools.find(pool => pool.asset.symbol === withdrawRequest.assetSymbol);
      if (withdrawRequest.withdrawNativeToken) {
        try {
          if (isCallStatic) {
            console.log('calling function through callStatic...')
            const tx = await pool.contract
              .connect(provider.getSigner())
              .callStatic
              .withdrawNativeToken(
                parseUnits(String(withdrawRequest.amount), config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals), { gasLimit: 300000 });
            console.log(tx);
            if (tx.code || tx.errorName || tx.errorSignature) return true;
          }
        } catch (error) {
          console.log("callStatic to withdraw AVAX error: ", error);
        }

        withdrawTransaction = await pool.contract.connect(provider.getSigner())
          .withdrawNativeToken(
            parseUnits(String(withdrawRequest.amount), config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals), { gasLimit: 300000 });
      } else {
        try {
          if (isCallStatic) {
            console.log('calling function through callStatic...')
            const tx = await pool.contract
              .connect(provider.getSigner())
              .callStatic
              .withdraw(
                parseUnits(String(withdrawRequest.amount),
                  config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals));
            console.log(tx);
            if (tx.code || tx.errorName || tx.errorSignature) return true;
          }
        } catch (error) {
          console.log("callStatic to withdraw error: ", error);
        }

        withdrawTransaction = await pool.contract.connect(provider.getSigner())
          .withdraw(
            parseUnits(String(withdrawRequest.amount),
              config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals));
      }
      await awaitConfirmation(withdrawTransaction, provider, 'deposit');

      setTimeout(() => {
        dispatch('network/updateBalance', {}, { root: true });
      }, 1000);

      setTimeout(() => {
        dispatch('setupPools');
      }, 30000);
    },
  }
};
