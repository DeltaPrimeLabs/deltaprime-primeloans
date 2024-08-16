import {awaitConfirmation, depositTermsToSign, signMessage, wrapContract} from '../utils/blockchain';
import DEPOSIT_SWAP from '@artifacts/contracts/DepositSwap.sol/DepositSwap.json';
import DEPOSIT_REWARDER from '/artifacts/contracts/interfaces/IDepositRewarder.sol/IDepositRewarder.json'
import {formatUnits, fromWei, parseUnits} from '@/utils/calculate';
import erc20ABI from '../../test/abis/ERC20.json';
import config from '@/config';
import {constructSimpleSDK} from "@paraswap/sdk";
import axios from "axios";
import {getSwapData} from "../utils/paraSwapUtils";


const ethers = require('ethers');
const SUCCESS_DELAY_AFTER_TRANSACTION = 1000;
let TOKEN_ADDRESSES;


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

      // Avalanche-specific methods
      if (window.chain === 'avalanche') {
        rootState.serviceRegistry.avalancheBoostService.emitRefreshAvalancheBoostData(rootState.network.provider, rootState.network.account);
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
      const dataFeeds = [...Object.keys(config.POOLS_CONFIG)];
      const poolContract = await wrapContract(state.pools.find(pool => pool.asset.symbol === depositRequest.assetSymbol).contract.connect(provider.getSigner()), dataFeeds);
      const wallet = rootState.network.account;

      if (fromWei(await poolContract.balanceOf(wallet)) === 0) {
        const signResult = await signMessage(provider, depositTermsToSign, rootState.network.account, true);
        if (!signResult) return;
        await rootState.serviceRegistry.termsService.saveSignedTerms(null, rootState.network.account, signResult, 'SAVINGS');
      }

      let depositTransaction;
      if (depositRequest.depositNativeToken) {
        depositTransaction = await poolContract
          .depositNativeToken({value: parseUnits(String(depositRequest.amount), decimals)});

        rootState.serviceRegistry.progressBarService.requestProgressBar();
        rootState.serviceRegistry.modalService.closeModal();
      } else {
        const allowance = formatUnits(await tokenContract.allowance(rootState.network.account, poolContract.address), decimals);

        if (parseFloat(allowance) < parseFloat(depositRequest.amount)) {
          let approveTransaction = await tokenContract.connect(provider.getSigner())
            //NOTE: ERC20 token contract is not allowed to append extra data to calldata because of Metamask's constraint.
            .approve(poolContract.address,
              parseUnits(String(depositRequest.amount), decimals));

          rootState.serviceRegistry.progressBarService.requestProgressBar();
          rootState.serviceRegistry.modalService.closeModal();

          await awaitConfirmation(approveTransaction, provider, 'approve');
        }


        const depositData = poolContract.interface.encodeFunctionData('deposit', [parseUnits(String(depositRequest.amount), decimals)]);
        const txParams = {
          to: poolContract.address,
          data: depositData
        };
        if (depositRequest.notifiClient) {
          // TODO: handle error
          const { txHash, notifiLoginResult } = await rootState.serviceRegistry.notifiService.sendTransactionWithLoginNotifi({
            notifiClient: depositRequest.notifiClient,
            provider,
            txParams,
            walletBlockchain: window.chain.toUpperCase(),
            walletAddress: rootState.network.account,
          })
          rootState.serviceRegistry.notifiService.refreshClientInfo(depositRequest.notifiClient)
        } else {
          const { hash } = await provider.getSigner().sendTransaction(txParams);
        }

        // let additionalSlot = '';
        // if (depositRequest.notifiClient) {
        //   const res = await depositRequest.notifiClient.beginLoginViaTransaction({walletBlockchain: window.chain.toUpperCase(), walletAddress: rootState.network.account});
        //   console.log('res from beginLoginViaTransaction', res);
        //   additionalSlot = res.nonce.replace('0x', '');
        // }
        
        
        // const depositData = poolContract.interface.encodeFunctionData('deposit', [parseUnits(String(depositRequest.amount), decimals)]);
        // const modifiedDepositData = depositData + additionalSlot;
        // console.log(0, 'depositData', modifiedDepositData);
        // depositTransaction = await provider.getSigner().sendTransaction({
        //   to: poolContract.address,
        //   data: modifiedDepositData
        // });
        // console.log(1, 'depositTransaction', depositTransaction);
        // if (depositRequest.notifiClient) {
        //   // await rootState.serviceRegistry.notifiService.login(depositRequest.notifiClient, provider,  rootState.network.account); // TODO: remove this line (simulate successful login only)
        //   const res = await depositRequest.notifiClient.completeLoginViaTransaction({
        //     walletBlockchain: window.chain.toUpperCase(),
        //     walletAddress: rootState.network.account,
        //     transactionSignature: depositTransaction.hash,
        //   })
        //   console.log('res', res);
        //   rootState.serviceRegistry.notifiService.refreshClientInfo(depositRequest.notifiClient)
        // } 
        // NOTE: built-in ethers.js Contract object does not support calldata manipulation.
        // depositTransaction = await poolContract
        //   .deposit(parseUnits(String(depositRequest.amount), decimals));
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

      rootState.serviceRegistry.sPrimeService.emitRefreshSPrimeDataWithDefault(provider, rootState.network.account);
      rootState.serviceRegistry.vPrimeService.emitRefreshVPrimeDataWithDefault(rootState.network.account);
    },

    async withdraw({state, rootState, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;
      let withdrawTransaction;
      const dataFeeds = [...Object.keys(config.POOLS_CONFIG)];
      const pool = state.pools.find(pool => pool.asset.symbol === withdrawRequest.assetSymbol);
      let poolContract = await wrapContract(pool.contract.connect(provider.getSigner()), dataFeeds);

      if (withdrawRequest.withdrawNativeToken) {
        withdrawTransaction = await poolContract
          .withdrawNativeToken(
            parseUnits(String(withdrawRequest.amount), config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals));

        rootState.serviceRegistry.progressBarService.requestProgressBar();
        rootState.serviceRegistry.modalService.closeModal();

      } else {
        const withdrawAmount = parseUnits(String(withdrawRequest.amount), config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals);

        const withdrawData = poolContract.interface.encodeFunctionData('withdraw', [withdrawAmount]);

        const txParams = {
          to: poolContract.address,
          data: withdrawData
        };
        if (withdrawRequest.notifiClient) {
          // TODO: handle error
          const { txHash, notifiLoginResult } = await rootState.serviceRegistry.notifiService.sendTransactionWithLoginNotifi({
            notifiClient: withdrawRequest.notifiClient,
            provider,
            txParams,
            walletBlockchain: window.chain.toUpperCase(),
            walletAddress: rootState.network.account,
          })
          rootState.serviceRegistry.notifiService.refreshClientInfo(withdrawRequest.notifiClient)
        } else {
          const { hash } = await provider.getSigner().sendTransaction(txParams);
        }

        // let additionalSlot = '';
        // if (withdrawRequest.notifiClient) {
        //   const res = await withdrawRequest.notifiClient.beginLoginViaTransaction({walletBlockchain: window.chain.toUpperCase(), walletAddress: rootState.network.account});
        //   console.log('res from beginLoginViaTransaction - withdraw', res);
        //   additionalSlot = res.nonce.replace('0x', '');
        // }

        // const withdrawData = poolContract.interface.encodeFunctionData('withdraw', [withdrawAmount]);
        // const modifiedWithdrawData = withdrawData + additionalSlot;
        // console.log(2, 'withdrawData', modifiedWithdrawData);
        // withdrawTransaction = await provider.getSigner().sendTransaction({
        //   to: poolContract.address,
        //   data: modifiedWithdrawData
        // });
        // console.log(3, 'withdrawTransaction', withdrawTransaction);
        // if (withdrawRequest.notifiClient) {
        //   const res = await withdrawRequest.notifiClient.completeLoginViaTransaction({
        //     walletBlockchain: window.chain.toUpperCase(),
        //     walletAddress: rootState.network.account,
        //     transactionSignature: withdrawTransaction.hash,
        //   })
        //   console.log('res', res);
        //   rootState.serviceRegistry.notifiService.refreshClientInfo(withdrawRequest.notifiClient)
        // }
        // NOTE: built-in ethers.js Contract object does not support calldata manipulation.
        // withdrawTransaction = await poolContract
        //   .withdraw(
        //     parseUnits(String(withdrawRequest.amount),
        //       config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals));

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

      rootState.serviceRegistry.sPrimeService.emitRefreshSPrimeDataWithDefault(provider, rootState.network.account);
      rootState.serviceRegistry.vPrimeService.emitRefreshVPrimeDataWithDefault(rootState.network.account);
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

    async claimAvalancheBoost({state, rootState, commit, dispatch}, {claimBoostRequest}) {
      const provider = rootState.network.provider;

      const rewarderContract = new ethers.Contract(claimBoostRequest.depositRewarderAddress, DEPOSIT_REWARDER.abi, provider.getSigner());

      const transaction = await rewarderContract.getRewardsFor(rootState.network.account);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'Claim Avalanche Boost rewards');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
      }, config.refreshDelay);
    },
  }
};
