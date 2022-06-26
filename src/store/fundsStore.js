import {awaitConfirmation, handleCall} from "../utils/blockchain";
import SMART_LOAN from '@contracts/SmartLoanLogicFacet.json'
import SMART_LOAN_FACTORY_TUP from '@contracts/SmartLoansFactoryTUP.json'
import SMART_LOAN_FACTORY from '@contracts/SmartLoansFactory.json'
import PANGOLIN_EXCHANGETUP from '@contracts/PangolinExchangeTUP.json'
import PANGOLIN_EXCHANGE from '@artifacts/contracts/PangolinExchange.sol/PangolinExchange.json'
import {formatUnits, fromWei, parseUnits, round, toWei} from "@/utils/calculate";
import config from "@/config";
import {acceptableSlippage, maxAvaxToBeSold, minAvaxToBeBought, parseLogs} from "../utils/calculate";
import {WrapperBuilder} from "redstone-evm-connector";
import {fetchCollateralFromPayments, fetchEventsForSmartLoan} from "../utils/graph";
import redstone from 'redstone-api';

const toBytes32 = require("ethers").utils.formatBytes32String;

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
    smartLoanContract: null,
    assets: null,
    supportedAssets: null,
    provider: null,
  },
  getters: {

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
  },
  actions: {

    async setup({dispatch}) {
      await dispatch('setupSupportedAssets');
      // await dispatch('setupSmartLoanContract');
      await dispatch('setupAssets');
    },


    async setupSupportedAssets({rootState, commit}) {
      const pangolinContract = new ethers.Contract(PANGOLIN_EXCHANGETUP.address, PANGOLIN_EXCHANGE.abi, provider.getSigner());
      // the first returned asset is a blockchain native currency, therefore used .slice(1)
      let supported = ((await pangolinContract.getAllAssets())).map(
        asset => ethers.utils.parseBytes32String(asset)
      );
      console.log(supported);

      commit('setSupportedAssets', supported);
    },

    async setupSmartLoanContract({state, rootState, dispatch, commit}) {
      const loan = new ethers.Contract(userLoan, LOAN.abi, provider.getSigner());
      loan.iface = new ethers.utils.Interface(LOAN.abi);

      const wrappedLoan = WrapperBuilder
        .wrapLite(loan)
        .usingPriceFeed(config.dataProviderId);

      commit('setLoan', wrappedLoan);
    },

    async setupAssets({state, commit, dispatch}) {
      console.log('async updateAssets({state, commit, dispatch}) {');

      console.log(state.assets);


      const nativeToken = Object.entries(config.ASSETS_CONFIG).find(asset => asset[0] === config.nativeToken);

      let assets = {};
      assets[nativeToken[0]] = nativeToken[1];
      state.supportedAssets.forEach(
        asset => assets[asset] = config.ASSETS_CONFIG[asset]
      );

      console.log(assets);

      redstone.getPrice(Object.keys(assets)).then(prices => {
        console.log(prices);
        Object.keys(assets).forEach(assetSymbol => {
          assets[assetSymbol].price = prices[assetSymbol].value;
        });
      });


      setTimeout(() => {
        commit('setAssets', assets);
      }, 1000);
      console.log(assets);
    },

    async createLoan({state, rootState, commit, dispatch}) {

    },

    async swapToWavax({state, rootState}) {
      const provider = rootState.network.provider;
      const wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider);
      await wavaxTokenContract.connect(provider.getSigner()).deposit({value: toWei('1000')});
    },

    async fund({state, rootState, commit, dispatch}) {
      const provider = rootState.network.provider;
      const smartLoanFactoryContract = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner());

      // const percentage = await smartLoanFactoryContract.getPercentagePrecision();
      // console.log(percentage);

      console.log(toBytes32('AVAX'));
      const transaction = await smartLoanFactoryContract.createAndFundLoan(toBytes32('AVAX'), toWei('10'), 0, {gasLimit: 50000000});
      // const transaction = await smartLoanFactoryContract.depositNativeToken({ value: toWei('1'), gasLimit: 500000});

      await awaitConfirmation(transaction, provider, 'fund');
    },
  }
}
