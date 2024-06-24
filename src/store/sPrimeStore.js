import {awaitConfirmation, wrapContract} from '../utils/blockchain';
import SPRIME from '@artifacts/contracts/token/sPrime.sol/sPrime.json';
import {parseUnits} from '@/utils/calculate';
import erc20ABI from '../../test/abis/ERC20.json';
import config from '@/config';
import {getTraderJoeV2IdSlippageFromPriceSlippage, toWei} from "../utils/calculate";


const ethers = require('ethers');
let TOKEN_ADDRESSES;


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

    async sPrimeTjV2Mint({state, rootState, dispatch}, {sPrimeMintRequest}) {
      const provider = rootState.network.provider;

      // let dataFeeds = ['PRIME', sPrimeMintRequest.secondAsset]
      let dataFeeds = [...Object.keys(config.POOLS_CONFIG), sPrimeMintRequest.secondAsset]
      const sprimeContract = await wrapContract(new ethers.Contract(sPrimeMintRequest.sPrimeAddress, SPRIME.abi, provider.getSigner()), dataFeeds);

      const secondAssetDecimals = config.SPRIME_CONFIG.TRADERJOEV2[sPrimeMintRequest.secondAsset].secondAssetDecimals;
      let amountPrime = toWei(sPrimeMintRequest.amountPrime.toString())
      let amountSecond = parseUnits(sPrimeMintRequest.amountSecond.toString(), secondAssetDecimals)

      let idSlippage = getTraderJoeV2IdSlippageFromPriceSlippage(sPrimeMintRequest.slippage / 100, config.SPRIME_CONFIG.TRADERJOEV2[sPrimeMintRequest.secondAsset].binStep);

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

      await sprimeContract.deposit(sPrimeMintRequest.activeId, idSlippage, amountPrime, amountSecond, sPrimeMintRequest.isRebalance, sPrimeMintRequest.slippage)

    },
    async sPrimeTjV2Rebalance({state, rootState, dispatch}, {sPrimeRebalanceRequest: sPrimeRebalanceRequest}) {
      const provider = rootState.network.provider;

      // let dataFeeds = ['PRIME', sPrimeMintRequest.secondAsset]
      let dataFeeds = [...Object.keys(config.POOLS_CONFIG), sPrimeRebalanceRequest.secondAsset]
      const sprimeContract = await wrapContract(new ethers.Contract(sPrimeRebalanceRequest.sPrimeAddress, SPRIME.abi, provider.getSigner()), dataFeeds);

      let idSlippage = getTraderJoeV2IdSlippageFromPriceSlippage(sPrimeRebalanceRequest.slippage / 100, config.SPRIME_CONFIG.TRADERJOEV2[sPrimeRebalanceRequest.secondAsset].binStep);

      //approvals
      await sprimeContract.deposit(sPrimeRebalanceRequest.activeId, idSlippage, 0, 0, sPrimeRebalanceRequest.isRebalance, sPrimeRebalanceRequest.slippage)

    },
    async sPrimeTjV2Redeem({state, rootState, dispatch}, {sPrimeRedeemRequest: sPrimeRedeemRequest}) {
      const provider = rootState.network.provider;

      let share = toWei(sPrimeRedeemRequest.share);

      let dataFeeds = [...Object.keys(config.POOLS_CONFIG), sPrimeRedeemRequest.secondAsset]
      const sprimeContract = await wrapContract(new ethers.Contract(sPrimeRedeemRequest.sPrimeAddress, SPRIME.abi, provider.getSigner()), dataFeeds);

      await sprimeContract.withdraw(share);
    }
  }
};
