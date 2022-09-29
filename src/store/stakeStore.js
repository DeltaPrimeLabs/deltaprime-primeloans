import {awaitConfirmation, handleCall} from '../utils/blockchain';
import {formatUnits, fromWei, parseUnits, round, toWei} from '@/utils/calculate';

const toBytes32 = require('ethers').utils.formatBytes32String;
const fromBytes32 = require('ethers').utils.parseBytes32String;


const ethereum = window.ethereum;

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
    stakedAssets: null,
  },
  getters: {
    getStakedAssets(state) {
      return state.stakedAssets;
    }
  },
  mutations: {
    setStakedAssets(state, stakedAssets) {
      state.stakedAssets = stakedAssets;
    },
  },
  actions: {

    async stakeStoreSetup({dispatch}) {
      await dispatch('updateStakedAvaxYakBalance');
    },

    async stakeAvaxYak({state, rootState, dispatch, commit}, {amount}) {

      const provider = rootState.network.provider;
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      // TODO method does not exist
      const stakeTransaction = await smartLoanContract.stakeAVAXYak(toWei(String(amount)), {gasLimit: 110000000});

      await awaitConfirmation(stakeTransaction, provider, 'stakeAvaxYak');

      await dispatch('updateStakedAvaxYakBalance');
      await dispatch('network/updateBalance', {}, {root: true})
    },

    async unstakeAvaxYak({state, rootState, dispatch, commit}, {amount}) {

      const provider = rootState.network.provider;
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      const receiptToAvaxConversionRate = state.stakedAssets.AVAX.protocols.YAK_YIELD.receiptToAvaxConversionRate;
      const receiptTokenAmount = amount / receiptToAvaxConversionRate;
      let receiptTokenAmountWei = toWei(String(receiptTokenAmount));
      if (receiptTokenAmountWei.gt(state.stakedAssets.AVAX.protocols.YAK_YIELD.receiptTokenBalanceWei)) {
        receiptTokenAmountWei = state.state.stakedAssets.AVAX.protocols.YAK_YIELD.receiptTokenBalanceWei
      }

      const unstakeTransaction = await smartLoanContract.unstakeAVAXYak(receiptTokenAmountWei, {gasLimit: 1100000});
      await awaitConfirmation(unstakeTransaction, provider, 'unstake')

      await dispatch('updateStakedAvaxYakBalance');
      await dispatch('network/updateBalance', {}, {root: true})
    },

    async updateStakedAvaxYakBalance({state, rootState, dispatch, commit}) {
      console.log('updateStakedAvax');
      const smartLoanContract = rootState.fundsStore.smartLoanContract;
      const stakingContractAddress = '0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95';
      const tokenContract = new ethers.Contract(stakingContractAddress, erc20ABI, provider.getSigner());
      const totalSupply = Number(await tokenContract.totalSupply());
      const totalDeposits = Number(await tokenContract.totalDeposits());
      const yrtToAvaxConversionRate = totalDeposits / totalSupply;
      const stakedYrtWei = await tokenContract.balanceOf(smartLoanContract.address);
      const stakedYrt = Number(fromWei(stakedYrtWei));
      const stakedAvax = stakedYrt * yrtToAvaxConversionRate;

      const stakedAssets = {
        AVAX: {
          protocols: {
            YAK_YIELD: {
              balance: stakedAvax,
              receiptTokenBalance: stakedYrt,
              receiptTokenBalanceWei: stakedYrtWei,
              receiptToAvaxConversionRate: yrtToAvaxConversionRate
            }
          }
        }
      }

      console.log(stakedAssets);
      commit('setStakedAssets', stakedAssets);
    },
  }
}
