import {awaitConfirmation, wrapContract} from '../utils/blockchain';
import SPRIME from '@artifacts/contracts/interfaces/ISPrime.sol/ISPrime.json';
import SPRIME_TJV2 from '@artifacts/contracts/interfaces/ISPrimeTraderJoe.sol/ISPrimeTraderJoe.json';
import SPRIME_UNISWAP from '@artifacts/contracts/interfaces/ISPrimeUniswap.sol/ISPrimeUniswap.json';
import {parseUnits} from '@/utils/calculate';
import erc20ABI from '../../test/abis/ERC20.json';
import config from '@/config';
import {fromWei, toWei} from "../utils/calculate";
import WAVAX from '../../test/abis/WAVAX.json';


const ethers = require('ethers');
let TOKEN_ADDRESSES;
const SUCCESS_DELAY_AFTER_TRANSACTION = 1000;


export default {
  namespaced: true,
  state: {},
  getters: {},
  mutations: {},
  actions: {
    async loadDeployments() {
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },

    async sPrimeStoreSetup({dispatch}) {
      await dispatch('loadDeployments');
    },

    async sPrimeMint({state, rootState, dispatch}, {sPrimeMintRequest}) {
      const provider = rootState.network.provider;

      // let dataFeeds = ['PRIME', sPrimeMintRequest.secondAsset]
      let dataFeeds = [...Object.keys(config.POOLS_CONFIG)]
      console.log('dataFeeds')
      console.log(dataFeeds)
      const sprimeContract = await wrapContract(new ethers.Contract(sPrimeMintRequest.sPrimeAddress, sPrimeMintRequest.dex === 'TRADERJOEV2' ? SPRIME_TJV2.abi : SPRIME_UNISWAP.abi, provider.getSigner()), dataFeeds);

      const secondAssetDecimals = config.SPRIME_CONFIG[sPrimeMintRequest.dex][sPrimeMintRequest.secondAsset].secondAssetDecimals;
      let amountPrime = toWei(sPrimeMintRequest.amountPrime ? Number(sPrimeMintRequest.amountPrime).toFixed(18) : '0')
      let amountSecond = parseUnits(sPrimeMintRequest.amountSecond ? Number(sPrimeMintRequest.amountSecond).toFixed(secondAssetDecimals) : '0', secondAssetDecimals)

      if (sPrimeMintRequest.isSecondAssetNative && sPrimeMintRequest.amountSecond > 0) {
        let wrapTx = await new ethers.Contract(TOKEN_ADDRESSES[sPrimeMintRequest.secondAsset], WAVAX, provider.getSigner()).deposit({value: amountSecond});
        await awaitConfirmation(wrapTx, provider, 'wrap');
      }

      //approvals
      await approve(TOKEN_ADDRESSES['PRIME'], amountPrime);
      await approve(TOKEN_ADDRESSES[sPrimeMintRequest.secondAsset], amountSecond);

      async function approve(address, amount) {
        const tokenContract = new ethers.Contract(address, erc20ABI, provider.getSigner());
        const allowance = await tokenContract.allowance(rootState.network.account, sPrimeMintRequest.sPrimeAddress);

        if (allowance.lt(amount)) {
          let approveTransaction = await tokenContract.connect(provider.getSigner())
            .approve(sPrimeMintRequest.sPrimeAddress, amount);
          rootState.serviceRegistry.progressBarService.requestProgressBar();
          rootState.serviceRegistry.modalService.closeModal();

          await awaitConfirmation(approveTransaction, provider, 'approve');
        }
      }

      console.log('sPrimeMintRequest.activeId: ', sPrimeMintRequest.activeId)
      console.log('sPrimeMintRequest.idSlippage: ', sPrimeMintRequest.idSlippage)
      console.log('amountPrime: ', amountPrime)
      console.log('amountSecond: ', amountSecond)
      console.log('sPrimeMintRequest.isRebalance: ', sPrimeMintRequest.isRebalance)
      console.log('sPrimeMintRequest.slippage: ', sPrimeMintRequest.slippage * 100)

      const transaction = await sprimeContract.deposit(sPrimeMintRequest.activeId, sPrimeMintRequest.idSlippage, amountPrime, amountSecond, sPrimeMintRequest.isRebalance, sPrimeMintRequest.slippage * 100, {gasLimit: 8000000})
      await awaitConfirmation(transaction, provider, 'mint');

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();


      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);
    },
    async sPrimeRebalance({state, rootState, dispatch}, {sPrimeRebalanceRequest: sPrimeRebalanceRequest}) {
      const provider = rootState.network.provider;

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      // let dataFeeds = ['PRIME', sPrimeMintRequest.secondAsset]
      let dataFeeds = [...Object.keys(config.POOLS_CONFIG), sPrimeRebalanceRequest.secondAsset]
      console.log('sPrimeRebalanceRequest.sPrimeAddress: ', sPrimeRebalanceRequest.sPrimeAddress)
      const sprimeContract = await wrapContract(new ethers.Contract(sPrimeRebalanceRequest.sPrimeAddress, sPrimeRebalanceRequest.dex === 'TRADERJOEV2' ? SPRIME_TJV2.abi : SPRIME_UNISWAP.abi, provider.getSigner()), dataFeeds);

      console.log('sPrimeRebalanceRequest.activeId: ', sPrimeRebalanceRequest.activeId)
      console.log('sPrimeRebalanceRequest.idSlippage: ', sPrimeRebalanceRequest.idSlippage)
      console.log('sPrimeRebalanceRequest.isRebalance: ', sPrimeRebalanceRequest.isRebalance)
      console.log('sPrimeRebalanceRequest.slippage * 100: ', sPrimeRebalanceRequest.slippage * 100)

      const transaction = await sprimeContract.deposit(sPrimeRebalanceRequest.activeId, sPrimeRebalanceRequest.idSlippage, 0, 0, sPrimeRebalanceRequest.isRebalance, sPrimeRebalanceRequest.slippage * 100, { gasLimit: 8000000 })
      await awaitConfirmation(transaction, provider, 'rebalance');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);
    },
    async sPrimeRedeem({state, rootState, dispatch}, {sPrimeRedeemRequest: sPrimeRedeemRequest}) {
      const provider = rootState.network.provider;

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let share = toWei(sPrimeRedeemRequest.share);

      let dataFeeds = [...Object.keys(config.POOLS_CONFIG), sPrimeRedeemRequest.secondAsset]
      const sprimeContract = await wrapContract(new ethers.Contract(sPrimeRedeemRequest.sPrimeAddress, SPRIME.abi, provider.getSigner()), dataFeeds);

      const transaction = await sprimeContract.withdraw(share);
      await awaitConfirmation(transaction, provider, 'redeem');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);
    }
  }
};
