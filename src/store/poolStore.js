import {awaitConfirmation, depositTermsToSign, signMessage, wrapContract} from '../utils/blockchain';
import DEPOSIT_SWAP from '@artifacts/contracts/DepositSwap.sol/DepositSwap.json';
import SPRIME from '@artifacts/contracts/token/sPrime.sol/sPrime.json';
import {formatUnits, fromWei, parseUnits} from '@/utils/calculate';
import erc20ABI from '../../test/abis/ERC20.json';
import config from '@/config';
import {getTraderJoeV2IdSlippageFromPriceSlippage, toWei} from "../utils/calculate";
import {constructSimpleSDK} from "@paraswap/sdk";
import axios from "axios";
import {getSwapData} from "../utils/paraSwapUtils";


const ethers = require('ethers');
const SUCCESS_DELAY_AFTER_TRANSACTION = 1000;
let TOKEN_ADDRESSES, SPRIME_TUP;


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
    setPools(state, pools) {
      state.pools = pools;
    },
  },
  actions: {

    async loadDeployments() {
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
      SPRIME_TUP = await import(`/deployments/${window.chain}/SPrimeUP.json`);
    },

    async poolStoreSetup({dispatch}) {
      await dispatch('setupPools');
      await dispatch('loadDeployments');
    },

    async setupPools({rootState, commit, dispatch}) {
      const poolService = rootState.serviceRegistry.poolService;

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      await poolService.setupPools(rootState.network.provider, rootState.network.account, redstonePriceData, rootState.serviceRegistry.ltipService)
        .subscribe(pools => {
          poolService.emitPools(pools);
          commit('setPools', pools);
          dispatch('setupsPrime');
        });

      // Arbitrum-specific methods
      if (window.chain === 'arbitrum') {
        rootState.serviceRegistry.ltipService.emitRefreshPoolLtipData();
      }
    },

    async setupsPrime({rootState, commit, state}) {
      const poolService = rootState.serviceRegistry.poolService;
      let resp = {};

      try {
        resp = await (await fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/sprime/${rootState.network.account.toLowerCase()}?network=${config.chainSlug}`)).json();
      } catch (error) {
        console.error('fetching sprime failed.');
      }

      let pools = state.pools;
      for (let pool of pools) {
        pool.sPrime = resp[pool.asset.symbol] ? resp[pool.asset.symbol].sPrime : '0';
      }

      commit('setPools', pools);
      poolService.emitPools(pools);
    },

    async deposit({state, rootState, commit, dispatch}, {depositRequest}) {
      const provider = rootState.network.provider;

      const tokenContract = new ethers.Contract(config.POOLS_CONFIG[depositRequest.assetSymbol].tokenAddress, erc20ABI, provider.getSigner());
      const decimals = config.ASSETS_CONFIG[depositRequest.assetSymbol].decimals;
      const poolContract = state.pools.find(pool => pool.asset.symbol === depositRequest.assetSymbol).contract;
      const wallet = rootState.network.account;

      if (fromWei(await poolContract.balanceOf(wallet)) === 0) {
        const signResult = await signMessage(provider, depositTermsToSign, rootState.network.account, true);
        if (!signResult) return;
        await rootState.serviceRegistry.termsService.saveSignedTerms(null, rootState.network.account, signResult, 'SAVINGS');
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
              parseUnits(String(depositRequest.amount), decimals));

          rootState.serviceRegistry.progressBarService.requestProgressBar();
          rootState.serviceRegistry.modalService.closeModal();

          await awaitConfirmation(approveTransaction, provider, 'approve');
        }

        depositTransaction = await poolContract
          .connect(provider.getSigner())
          .deposit(parseUnits(String(depositRequest.amount), decimals));
      }
      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

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
            parseUnits(String(withdrawRequest.amount), config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals));

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
      console.log(swapDepositRequest);
      const provider = rootState.network.provider;

      const depositSwapContract = new ethers.Contract(config.depositSwapAddress, DEPOSIT_SWAP.abi, provider.getSigner());
      const sourceAmountInWei = parseUnits(swapDepositRequest.sourceAmount, config.ASSETS_CONFIG[swapDepositRequest.sourceAsset].decimals);
      const targetAmountInWei = parseUnits(swapDepositRequest.targetAmount, config.ASSETS_CONFIG[swapDepositRequest.targetAsset].decimals);

      const sourceAssetAddress = TOKEN_ADDRESSES[swapDepositRequest.sourceAsset];
      const targetAssetAddress = TOKEN_ADDRESSES[swapDepositRequest.targetAsset];

      const sourceAssetDecimals = config.ASSETS_CONFIG[swapDepositRequest.sourceAsset].decimals;
      const targetAssetDecimals = config.ASSETS_CONFIG[swapDepositRequest.targetAsset].decimals;

      const approveTransaction = await swapDepositRequest.sourcePoolContract
        .connect(provider.getSigner())
        .approve(config.depositSwapAddress, sourceAmountInWei);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      console.log(approveTransaction);
      await awaitConfirmation(approveTransaction, provider, 'approve');

      const paraSwapSDK = constructSimpleSDK({chainId: config.chainId, axios});
      const swapData = await getSwapData(
        paraSwapSDK,
        config.depositSwapAddress,
        sourceAssetAddress,
        targetAssetAddress,
        sourceAmountInWei,
        sourceAssetDecimals,
        targetAssetDecimals
      )

      console.log(swapData);

      console.log('log(swapData.routeData.selector)', swapData.routeData.selector);
      console.log('log(swapData.routeData.data)', swapData.routeData.data);
      console.log('log(sourceAssetAddress)', sourceAssetAddress);
      console.log('log(sourceAmountInWei)', sourceAmountInWei);
      console.log('log(targetAssetAddress)', targetAssetAddress);
      console.log('log(targetAmountInWei)', targetAmountInWei);

      const depositSwapTransaction = await depositSwapContract.depositSwapParaSwap(
        swapData.routeData.selector,
        swapData.routeData.data,
        sourceAssetAddress,
        sourceAmountInWei,
        targetAssetAddress,
        targetAmountInWei
      );

      console.log(depositSwapTransaction);

      await awaitConfirmation(depositSwapTransaction, provider, 'depositSwap');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      rootState.serviceRegistry.poolService.emitPoolDepositChange(swapDepositRequest.sourceAmount, swapDepositRequest.sourceAsset, 'WITHDRAW');
      rootState.serviceRegistry.poolService.emitPoolDepositChange(swapDepositRequest.targetAmount, swapDepositRequest.targetAsset, 'DEPOSIT');
    },

    async sPrimeTjV2Mint({state, rootState, dispatch}, {sPrimeMintRequest}) {
      const provider = rootState.network.provider;

      // let dataFeeds = ['PRIME', sPrimeMintRequest.secondAsset]
      let dataFeeds = [...Object.keys(config.POOLS_CONFIG), sPrimeMintRequest.secondAsset]
      const sprimeContract = await wrapContract(new ethers.Contract(SPRIME_TUP.address, SPRIME.abi, provider.getSigner()), dataFeeds);

      const secondAssetDecimals = config.SPRIME_CONFIG.TRADERJOEV2[sPrimeMintRequest.secondAsset].secondAssetDecimals;
      let amountPrime = toWei(sPrimeMintRequest.amountPrime.toString())
      let amountSecond = parseUnits(sPrimeMintRequest.amountSecond.toString(), secondAssetDecimals)

      let idSlippage = getTraderJoeV2IdSlippageFromPriceSlippage(sPrimeMintRequest.slippage / 100, config.SPRIME_CONFIG.TRADERJOEV2[sPrimeMintRequest.secondAsset].binStep);

      //approvals
      await approve(TOKEN_ADDRESSES['PRIME'], amountPrime);
      await approve(TOKEN_ADDRESSES[sPrimeMintRequest.secondAsset], amountSecond);

      async function approve(address, amount) {
        const tokenContract = new ethers.Contract(address, erc20ABI, provider.getSigner());
        const allowance = await tokenContract.allowance(rootState.network.account, SPRIME_TUP.address);

        if (allowance.lt(amount)) {
          let approveTransaction = await tokenContract.connect(provider.getSigner())
            .approve(SPRIME_TUP.address, amount);
          rootState.serviceRegistry.progressBarService.requestProgressBar();
          rootState.serviceRegistry.modalService.closeModal();

          await awaitConfirmation(approveTransaction, provider, 'approve');
        }
      }

      await sprimeContract.deposit(sPrimeMintRequest.activeId, idSlippage, amountPrime, amountSecond, sPrimeMintRequest.isRebalance, sPrimeMintRequest.slippage, {gasLimit: 4000000})

    }
  }
};
