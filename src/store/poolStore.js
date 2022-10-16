import {awaitConfirmation, handleCall} from '../utils/blockchain';
import POOL from '@artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import WAVAX_POOL_TUP from '@contracts/WavaxPoolTUP.json';
import USDC_POOL_TUP from '@contracts/UsdcPoolTUP.json';
import {formatUnits, fromWei, parseUnits, round, toWei} from '@/utils/calculate';
import config from '@/config';


const toBytes32 = require('ethers').utils.formatBytes32String;

const ethers = require('ethers');

const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdcTokenAddress = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';

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

const POOLS_CONFIG = {
  AVAX: {
    address: WAVAX_POOL_TUP.address,
    tokenAddress: wavaxTokenAddress,
  },
  USDC: {
    address: USDC_POOL_TUP.address,
    tokenAddress: usdcTokenAddress
  }
}

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
      const poolsFromConfig = Object.keys(POOLS_CONFIG);
      const pools = {};
      poolsFromConfig.forEach(poolAsset => {
        const poolContract = new ethers.Contract(POOLS_CONFIG[poolAsset].address, POOL.abi, provider.getSigner());
        Promise.all([
          poolContract.totalSupply(),
          poolContract.balanceOf(rootState.network.account),
          poolContract.getDepositRate(),
          poolContract.getBorrowingRate()
        ]).then(poolDetails => {
          const pool = {
            asset: config.ASSETS_CONFIG[poolAsset],
            contract: poolContract,
            tvl: formatUnits(String(poolDetails[0]), config.ASSETS_CONFIG[poolAsset].decimals),
            deposit: formatUnits(String(poolDetails[1]), config.ASSETS_CONFIG[poolAsset].decimals),
            apy: fromWei(poolDetails[2]),
            borrowingAPY: fromWei(poolDetails[3]),
            interest: 1.23456
          }
          pools[poolAsset] = pool;
        });
      });
      setTimeout(() => {
        commit('setPools', pools);
      }, 1000);
    },

    async deposit({state, rootState, commit, dispatch}, {depositRequest}) {
      const provider = rootState.network.provider;

      const tokenContract = new ethers.Contract(POOLS_CONFIG[depositRequest.assetSymbol].tokenAddress, erc20ABI, provider.getSigner());

      await tokenContract.connect(provider.getSigner())
        .approve(state.pools[depositRequest.assetSymbol].contract.address,
          parseUnits(String(depositRequest.amount), config.ASSETS_CONFIG[depositRequest.assetSymbol].decimals));
      const depositTransaction = await state.pools[depositRequest.assetSymbol].contract
        .connect(provider.getSigner())
        .deposit(parseUnits(String(depositRequest.amount), config.ASSETS_CONFIG[depositRequest.assetSymbol].decimals));
      await awaitConfirmation(depositTransaction, provider, 'deposit');
      await dispatch('setupPools');
    },

    async withdraw({state, rootState, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;
      await state.pools[withdrawRequest.assetSymbol].contract.connect(provider.getSigner())
        .withdraw(
          parseUnits(String(withdrawRequest.amount),
            config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals));

      await dispatch('setupPools');
    },
  }
}
