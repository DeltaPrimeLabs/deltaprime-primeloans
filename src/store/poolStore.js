import {awaitConfirmation, depositTermsToSign, signMessage} from '../utils/blockchain';
import POOL from '@artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import DEPOSIT_SWAP from '@artifacts/contracts/DepositSwap.sol/DepositSwap.json';
import {formatUnits, fromWei, parseUnits} from '@/utils/calculate';
import erc20ABI from '../../test/abis/ERC20.json';
import config from '@/config';


const ethers = require('ethers');
const DEPOSIT_SWAP_CONTRACT_ADDRESS = '0x74B5C3499AbDe6D85B6287617195813455051713';
const SUCCESS_DELAY_AFTER_TRANSACTION = 1000;

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
      const poolService = rootState.serviceRegistry.poolService;

      const redstonePriceDataRequest = await fetch('https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-avalanche-prod');
      const redstonePriceData = await redstonePriceDataRequest.json();

      await poolService.setupPools(rootState.network.provider, rootState.network.account, redstonePriceData)
        .subscribe(pools => {
          poolService.emitPools(pools);
          commit('setPools', pools);
        });
    },

    async deposit({state, rootState, commit, dispatch}, {depositRequest}) {
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
        depositTransaction = await poolContract
          .connect(provider.getSigner())
          .depositNativeToken({value: parseUnits(String(depositRequest.amount), decimals)});

        rootState.serviceRegistry.progressBarService.requestProgressBar();
        rootState.serviceRegistry.modalService.closeModal();
      } else {
        const allowance = formatUnits(await tokenContract.allowance(rootState.network.account, poolContract.address), decimals);

        if (parseFloat(allowance) < parseFloat(depositRequest.amount)) {
          let approveTransaction = await tokenContract.connect(provider.getSigner())
            .approve(poolContract.address,
              parseUnits(String(depositRequest.amount), decimals), {gasLimit: 100000});

          rootState.serviceRegistry.progressBarService.requestProgressBar();
          rootState.serviceRegistry.modalService.closeModal();

          await awaitConfirmation(approveTransaction, provider, 'approve');
        }

        depositTransaction = await poolContract
          .connect(provider.getSigner())
          .deposit(parseUnits(String(depositRequest.amount), decimals));
      }
      await awaitConfirmation(depositTransaction, provider, 'deposit');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

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
      const pool = state.pools.find(pool => pool.asset.symbol === withdrawRequest.assetSymbol);
      if (withdrawRequest.withdrawNativeToken) {
        withdrawTransaction = await pool.contract.connect(provider.getSigner())
          .withdrawNativeToken(
            parseUnits(String(withdrawRequest.amount), config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals), {gasLimit: 300000});

        rootState.serviceRegistry.progressBarService.requestProgressBar();
        rootState.serviceRegistry.modalService.closeModal();

      } else {
        withdrawTransaction = await pool.contract.connect(provider.getSigner())
          .withdraw(
            parseUnits(String(withdrawRequest.amount),
              config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals));

        rootState.serviceRegistry.progressBarService.requestProgressBar();
        rootState.serviceRegistry.modalService.closeModal();

      }
      await awaitConfirmation(withdrawTransaction, provider, 'deposit');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(() => {
        dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(() => {
        dispatch('setupPools');
      }, 30000);
    },

    async swapDeposit({state, rootState, dispatch}, {swapDepositRequest}) {
      const provider = rootState.network.provider;

      const depositSwapContract = new ethers.Contract(DEPOSIT_SWAP_CONTRACT_ADDRESS, DEPOSIT_SWAP.abi, provider.getSigner());
      const sourceAmountInWei = parseUnits(swapDepositRequest.sourceAmount, config.ASSETS_CONFIG[swapDepositRequest.sourceAsset].decimals);
      const targetAmountInWei = parseUnits(swapDepositRequest.targetAmount, config.ASSETS_CONFIG[swapDepositRequest.targetAsset].decimals);

      const approveTransaction = await swapDepositRequest.sourcePoolContract
        .connect(provider.getSigner())
        .approve(DEPOSIT_SWAP_CONTRACT_ADDRESS, sourceAmountInWei, {gasLimit: 100000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(approveTransaction, provider, 'approve');


      const depositSwapTransaction = await depositSwapContract.depositSwap(
        sourceAmountInWei,
        targetAmountInWei,
        swapDepositRequest.path,
        swapDepositRequest.adapters,
      );

      await awaitConfirmation(depositSwapTransaction, provider, 'depositSwap');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      rootState.serviceRegistry.poolService.emitPoolDepositChange(swapDepositRequest.sourceAmount, swapDepositRequest.sourceAsset, 'WITHDRAW');
      rootState.serviceRegistry.poolService.emitPoolDepositChange(swapDepositRequest.targetAmount, swapDepositRequest.targetAsset, 'DEPOSIT');
    }
  }
};
