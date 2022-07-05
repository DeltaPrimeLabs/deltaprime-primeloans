import {awaitConfirmation, handleCall} from '../utils/blockchain';
import SMART_LOAN from '@contracts/SmartLoanLogicFacet.json';
import SMART_LOAN_FACTORY_TUP from '@contracts/SmartLoansFactoryTUP.json';
import SMART_LOAN_FACTORY from '@contracts/SmartLoansFactory.json';
import PANGOLIN_EXCHANGETUP from '@contracts/PangolinExchangeTUP.json';
import PANGOLIN_EXCHANGE from '@artifacts/contracts/PangolinExchange.sol/PangolinExchange.json';
import {formatUnits, fromWei, parseUnits, round, toWei} from '@/utils/calculate';
import config from '@/config';
import {acceptableSlippage, maxAvaxToBeSold, minAvaxToBeBought, parseLogs} from '../utils/calculate';
import {WrapperBuilder} from 'redstone-evm-connector';
import {fetchCollateralFromPayments, fetchEventsForSmartLoan} from '../utils/graph';
import redstone from 'redstone-api';


const toBytes32 = require('ethers').utils.formatBytes32String;

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
    assets: null,
    supportedAssets: null,
    provider: null,
    smartLoanContract: null,
    smartLoanFactoryContract: null,
    wavaxTokenContract: null,
    assetBalances: null,
  },
  getters: {
    getSmartLoanContract(state) {
      return state.smartLoanContract;
    }

  },
  mutations: {
    setSmartLoanContract(state, smartLoanContract) {
      state.smartLoanContract = smartLoanContract;
    },

    setAssets(state, assets) {
      state.assets = assets;
    },

    setSupportedAssets(state, assets) {
      state.supportedAssets = assets;
    },

    setSmartLoanFactoryContract(state, smartLoanFactoryContract) {
      state.smartLoanFactoryContract = smartLoanFactoryContract;
    },

    setWavaxTokenContract(state, wavaxTokenContract) {
      state.wavaxTokenContract = wavaxTokenContract;
    },

    setAssetBalances(state, assetBalances) {
      state.assetBalances = assetBalances;
    },
  },
  actions: {
    async fundsStoreSetup({dispatch}) {
      await dispatch('setupSupportedAssets');
      await dispatch('setupAssets');
      await dispatch('setupContracts');
      await dispatch('getAllAssetsBalances');
    },


    async setupSupportedAssets({rootState, commit}) {
      const pangolinContract = new ethers.Contract(PANGOLIN_EXCHANGETUP.address, PANGOLIN_EXCHANGE.abi, provider.getSigner());
      let supported = ((await pangolinContract.getAllAssets())).map(
        asset => ethers.utils.parseBytes32String(asset)
      );

      commit('setSupportedAssets', supported);
    },

    async setupAssets({state, commit, dispatch}) {

      const nativeToken = Object.entries(config.ASSETS_CONFIG).find(asset => asset[0] === config.nativeToken);

      let assets = {};
      assets[nativeToken[0]] = nativeToken[1];
      state.supportedAssets.forEach(
        asset => assets[asset] = config.ASSETS_CONFIG[asset]
      );


      redstone.getPrice(Object.keys(assets)).then(prices => {
        Object.keys(assets).forEach(assetSymbol => {
          assets[assetSymbol].price = prices[assetSymbol].value;
        });
      });


      setTimeout(() => {
        commit('setAssets', assets);
      }, 5000);
    },

    async setupContracts({state, rootState, commit, dispatch}) {
      const provider = rootState.network.provider;

      const smartLoanFactoryContract = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner());
      const wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider.getSigner());
      const smartLoanContract = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner());

      commit('setSmartLoanFactoryContract', smartLoanFactoryContract);
      commit('setWavaxTokenContract', wavaxTokenContract);

      await dispatch('setupSmartLoanContract');
    },

    async setupSmartLoanContract({state, rootState, commit, dispatch}) {
      const provider = rootState.network.provider;
      const smartLoanAddress = await state.smartLoanFactoryContract.getLoanForOwner(rootState.network.account);

      const smartLoanContract = new ethers.Contract(smartLoanAddress, SMART_LOAN.abi, provider.getSigner());

      const wrappedSmartLoanContract = WrapperBuilder.wrapLite(smartLoanContract).usingPriceFeed(config.dataProviderId);

      if (wrappedSmartLoanContract) {
        commit('setSmartLoanContract', wrappedSmartLoanContract);
      }
    },

    async createLoan({state, rootState, commit, dispatch}) {
      const provider = rootState.network.provider;
      const transaction = await state.smartLoanFactoryContract.createLoan({gasLimit: 50000000});

      await awaitConfirmation(transaction, provider, 'createLoan');
    },

    async createAndFundLoan({state, rootState, commit, dispatch}) {
      const provider = rootState.network.provider;
      await state.wavaxTokenContract.connect(provider.getSigner()).approve(state.smartLoanFactoryContract.address, toWei('2'));
      const wrappedSmartLoanFactoryContract = WrapperBuilder.wrapLite(state.smartLoanFactoryContract).usingPriceFeed(config.dataProviderId);

      const transaction = await wrappedSmartLoanFactoryContract.createAndFundLoan(toBytes32('AVAX'), state.wavaxTokenContract.address, toWei('2'), toBytes32('AVAX'), toWei('2'), {gasLimit: 50000000});

      await awaitConfirmation(transaction, provider, 'createAndFundLoan');
    },

    async getAllAssetsBalances({state, rootState, commit}) {
      console.log(state.smartLoanContract);
      const balances = await state.smartLoanContract.getAllAssetsBalances();
      console.log(balances);

      commit('setAssetBalances', balances);
    },

    async swapToWavax({state, rootState}) {
      const provider = rootState.network.provider;
      await state.wavaxTokenContract.connect(provider.getSigner()).deposit({value: toWei('1000')});
    },

    async fund({state, rootState, commit, dispatch}) {
      const provider = rootState.network.provider;

      await state.wavaxTokenContract.connect(provider.getSigner()).approve(state.smartLoanContract.address, toWei('200'));
      const transaction = await state.smartLoanContract.fund(toBytes32('AVAX'), toWei('10'), {gasLimit: 50000000});

      await awaitConfirmation(transaction, provider, 'fund');
    },

    async withdraw({state, rootState, commit, dispatch}) {
      const provider = rootState.network.provider;

      await state.wavaxTokenContract.connect(provider.getSigner()).approve(SMART_LOAN_FACTORY_TUP.address, toWei('200'));
      const transaction = await state.smartLoanContract.withdraw(toBytes32('AVAX'), toWei('10'), {gasLimit: 50000000});

      await awaitConfirmation(transaction, provider, 'fund');
    },

    async borrow({state, rootState, commit, dispatch}) {
      const provider = rootState.network.provider;

      await state.wavaxTokenContract.connect(provider.getSigner()).approve(SMART_LOAN_FACTORY_TUP.address, toWei('5'));
      const transaction = await state.smartLoanContract.borrow(toBytes32('AVAX'), toWei('2'), {gasLimit: 50000000});

      await awaitConfirmation(transaction, provider, 'fund');
    },

    async repay({state, rootState, commit, dispatch}) {
      const provider = rootState.network.provider;

      await state.wavaxTokenContract.connect(provider.getSigner()).approve(SMART_LOAN_FACTORY_TUP.address, toWei('200'));
      const transaction = await state.smartLoanContract.repay(toBytes32('AVAX'), toWei('10'), {gasLimit: 50000000});

      await awaitConfirmation(transaction, provider, 'fund');
    },


  }
};
