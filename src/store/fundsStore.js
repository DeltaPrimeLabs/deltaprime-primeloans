import {
  awaitConfirmation,
  isOracleError,
  signMessage,
  loanTermsToSign,
  wrapContract, getLog, decodeOutput
} from '../utils/blockchain';
import SMART_LOAN from '@artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import {formatUnits, fromWei, parseUnits, toWei} from '@/utils/calculate';
import config from '@/config';
import redstone from 'redstone-api';
import {BigNumber, utils} from 'ethers';
import * as AWS from 'aws-sdk';
import awsConfig from '../../.secrets/awsConfig.json';
import {getBinPrice, mergeArrays, paraSwapRouteToSimpleData, removePaddedTrailingZeros} from '../utils/calculate';
import wrappedAbi from '../../test/abis/WAVAX.json';
import erc20ABI from '../../test/abis/ERC20.json';
import router from '@/router';

import LB_PAIR from '/artifacts/contracts/interfaces/joe-v2/ILBPair.sol/ILBPair.json'

import {constructSimpleSDK, SimpleFetchSDK, SwapSide} from '@paraswap/sdk';
import axios from 'axios';
import LB_TOKEN from '/artifacts/contracts/interfaces/joe-v2/ILBToken.sol/ILBToken.json'
import MULTICALL from '/artifacts/contracts/lib/Multicall3.sol/Multicall3.json'
import {decodeFunctionData} from "viem";

const toBytes32 = require('ethers').utils.formatBytes32String;
const fromBytes32 = require('ethers').utils.parseBytes32String;
const ethers = require('ethers');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const SUCCESS_DELAY_AFTER_TRANSACTION = 1000;

let SMART_LOAN_FACTORY_TUP;
let DIAMOND_BEACON;
let SMART_LOAN_FACTORY;
let TOKEN_MANAGER;
let TOKEN_MANAGER_TUP;
let TOKEN_ADDRESSES;

let readProvider;
let multicallContract;


AWS.config.update({
  region: 'us-east-1',
  endpoint: 'dynamodb.us-east-1.amazonaws.com',
  accessKeyId: awsConfig.accessKey,
  secretAccessKey: awsConfig.secretKey
});

const docClient = new AWS.DynamoDB.DocumentClient();

export default {
  namespaced: true,
  state: {
    assets: null,
    lpAssets: null,
    concentratedLpAssets: null,
    traderJoeV2LpAssets: null,
    balancerLpAssets: null,
    levelLpAssets: null,
    gmxV2Assets: null,
    supportedAssets: null,
    provider: null,
    readSmartLoanContract: null,
    smartLoanContract: null,
    smartLoanFactoryContract: null,
    wrappedTokenContract: null,
    multicallContract: null,
    assetBalances: null,
    balancerLpBalances: null,
    lpBalances: null,
    concentratedLpBalances: null,
    levelLpBalances: null,
    gmxV2Balances: null,
    accountApr: null,
    debt: null,
    totalValue: null,
    thresholdWeightedValue: null,
    health: null,
    fullLoanStatus: {},
    noSmartLoan: null,
    protocolPaused: false,
    oracleError: false,
    debtsPerAsset: null,
    apys: null,
  },
  mutations: {
    setSmartLoanContract(state, smartLoanContract) {
      state.smartLoanContract = smartLoanContract;
    },

    setReadSmartLoanContract(state, smartLoanContract) {
      state.readSmartLoanContract = smartLoanContract;
    },

    setApys(state, apys) {
      state.apys = apys;
    },

    setAssets(state, assets) {
      state.assets = assets;
    },

    setLpAssets(state, assets) {
      state.lpAssets = assets;
    },

    setConcentratedLpAssets(state, assets) {
      state.concentratedLpAssets = assets;
    },

    setTraderJoeV2LpAssets(state, assets) {
      state.traderJoeV2LpAssets = assets;
    },

    setBalancerLpAssets(state, assets) {
      state.balancerLpAssets = assets;
    },

    setLevelLpAssets(state, assets) {
      state.levelLpAssets = assets;
    },

    setGmxV2Assets(state, assets) {
      state.gmxV2Assets = assets;
    },

    setSupportedAssets(state, assets) {
      state.supportedAssets = assets;
    },

    setSmartLoanFactoryContract(state, smartLoanFactoryContract) {
      state.smartLoanFactoryContract = smartLoanFactoryContract;
    },

    setWrappedTokenContract(state, wrappedTokenContract) {
      state.wrappedTokenContract = wrappedTokenContract;
    },

    setMulticallContract(state, multicall) {
      state.multicallContract = multicall;
    },

    setAssetBalances(state, assetBalances) {
      state.assetBalances = assetBalances;
    },

    setSingleAssetBalance(state, assetBalanceChange) {
      state.assetBalances[assetBalanceChange.asset] = assetBalanceChange.balance;
    },

    setSingleAssetCurrentExposure(state, assetExposureChange) {
      state.assets[assetExposureChange.asset].currentExposure += assetExposureChange.exposureChange;
    },

    setLpBalances(state, lpBalances) {
      state.lpBalances = lpBalances;
    },

    setConcentratedLpBalances(state, lpBalances) {
      state.concentratedLpBalances = lpBalances;
    },

    setBalancerLpBalances(state, lpBalances) {
      state.balancerLpBalances = lpBalances;
    },

    setLevelLpBalances(state, lpBalances) {
      state.levelLpBalances = lpBalances;
    },

    setGmxV2Balances(state, balances) {
      state.gmxV2Balances = balances;
    },

    setFullLoanStatus(state, status) {
      state.fullLoanStatus = status;
    },

    setNoSmartLoan(state, noSmartLoan) {
      state.noSmartLoan = noSmartLoan;
    },

    setProtocolPaused(state, paused) {
      state.protocolPaused = paused;
    },

    setOracleError(state, error) {
      state.oracleError = error;
    },

    setDebtsPerAsset(state, debtsPerAsset) {
      state.debtsPerAsset = debtsPerAsset;
    },

    setSingleAssetDebt(state, assetDebtChange) {
      state.debtsPerAsset[assetDebtChange.asset].debt = assetDebtChange.debt;
    },

    setAccountApr(state, apr) {
      state.accountApr = apr;
    },
  },

  getters: {
    getCollateral(state) {
      return state.fullLoanStatus.totalValue - state.fullLoanStatus.debt;
    },
  },

  actions: {
    async fundsStoreSetup({state, rootState, dispatch, commit}) {
      if (!rootState.network.provider) return;
      await dispatch('loadDeployments');
      await dispatch('setupContracts');
      await dispatch('setupSmartLoanContract');
      await dispatch('setupSupportedAssets');
      await dispatch('setupApys');
      await dispatch('setupAssets');
      await dispatch('setupLpAssets');
      await dispatch('setupConcentratedLpAssets');
      await dispatch('setupTraderJoeV2LpAssets');
      if (config.BALANCER_LP_ASSETS_CONFIG) await dispatch('setupBalancerLpAssets');
      if (config.LEVEL_LP_ASSETS_CONFIG) await dispatch('setupLevelLpAssets');
      if (config.GMX_V2_ASSETS_CONFIG) await dispatch('setupGmxV2Assets');
      await dispatch('stakeStore/updateStakedPrices', null, {root: true});
      state.assetBalances = [];

      const diamond = new ethers.Contract(DIAMOND_BEACON.address, DIAMOND_BEACON.abi, provider.getSigner());
      readProvider = new ethers.providers.JsonRpcProvider(config.readRpcUrl);
      multicallContract = new ethers.Contract(config.multicallAddress, MULTICALL.abi, readProvider);

      let isActive = await diamond.getStatus();
      await commit('setProtocolPaused', !isActive);

      if (state.smartLoanContract.address !== NULL_ADDRESS) {
        state.assetBalances = null;
        await dispatch('getAllAssetsApys');
        await dispatch('getAllAssetsBalances');
        await dispatch('stakeStore/updateStakedBalances', null, {root: true});
        await dispatch('getDebtsPerAsset');
        rootState.serviceRegistry.aprService.emitRefreshApr();
        await dispatch('setupAssetExposures');
        try {
          await dispatch('getFullLoanStatus');
        } catch (e) {
          if (isOracleError(e)) await commit('setOracleError', true);
        }

        commit('setNoSmartLoan', false);
      } else {
        commit('setNoSmartLoan', true);
      }
    },

    async loadDeployments() {
      SMART_LOAN_FACTORY_TUP = await import(`/deployments/${window.chain}/SmartLoansFactoryTUP.json`);
      DIAMOND_BEACON = await import(`/deployments/${window.chain}/SmartLoanDiamondBeacon.json`);
      SMART_LOAN_FACTORY = await import(`/deployments/${window.chain}/SmartLoansFactory.json`);
      TOKEN_MANAGER = await import(`/deployments/${window.chain}/TokenManager.json`);
      TOKEN_MANAGER_TUP = await import(`/deployments/${window.chain}/TokenManagerTUP.json`);
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },

    async updateFunds({state, dispatch, commit, rootState}) {
      console.log('updateFunds')
      try {
        if (state.smartLoanContract.address !== NULL_ADDRESS) {
          commit('setNoSmartLoan', false);
        }

        await dispatch('setupApys');
        await dispatch('setupAssets');
        await dispatch('setupLpAssets');
        await dispatch('setupConcentratedLpAssets');
        await dispatch('setupTraderJoeV2LpAssets');
        if (config.BALANCER_LP_ASSETS_CONFIG) await dispatch('setupBalancerLpAssets');
        if (config.LEVEL_LP_ASSETS_CONFIG) await dispatch('setupLevelLpAssets');
        if (config.GMX_V2_ASSETS_CONFIG) await dispatch('setupGmxV2Assets');
        await dispatch('getAllAssetsBalances');
        await dispatch('getAllAssetsApys');
        await dispatch('getDebtsPerAsset');
        await dispatch('getFullLoanStatus');
        await dispatch('stakeStore/updateStakedBalances', null, {root: true});

        rootState.serviceRegistry.aprService.emitRefreshApr();
        rootState.serviceRegistry.healthService.emitRefreshHealth();

        await dispatch('setupAssetExposures');

        setTimeout(async () => {
          await dispatch('getFullLoanStatus');
        }, 5000);
      } catch (error) {
        console.error(error);
        console.error('ERROR DURING UPDATE FUNDS');
        console.warn('refreshing page in 5s');
        await dispatch('updateFunds');
      }
    },


    async setupSupportedAssets({commit}) {
      const tokenManager = new ethers.Contract(TOKEN_MANAGER_TUP.address, TOKEN_MANAGER.abi, provider.getSigner());
      const whiteListedTokenAddresses = await tokenManager.getSupportedTokensAddresses();

      const supported = whiteListedTokenAddresses
        .map(address => Object.keys(TOKEN_ADDRESSES).find(symbol => symbol !== 'default' && TOKEN_ADDRESSES[symbol].toLowerCase() === address.toLowerCase()));

      commit('setSupportedAssets', supported);
    },

    async setupApys({commit}) {
      let params = {
        TableName: "apys-prod"
      };

      const apyDoc = await docClient.scan(params).promise();
      const apys = {};

      apyDoc.Items.map(apy => {
        apys[apy.id] = {...apy};
      });

      commit('setApys', apys);
    },

    async setupAssets({state, commit, rootState}) {
      const nativeToken = Object.entries(config.ASSETS_CONFIG).find(asset => asset[0] === config.nativeToken);

      let assets = {};
      assets[nativeToken[0]] = nativeToken[1];

      Object.values(config.ASSETS_CONFIG).forEach(
        asset => {
          assets[asset.symbol] = asset;
        }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(assets).forEach(assetSymbol => {
        assets[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
      });
      commit('setAssets', assets);

      rootState.serviceRegistry.priceService.emitRefreshPrices();
    },

    async setupAssetExposures({state, rootState, commit}) {
      const tokenManager = new ethers.Contract(TOKEN_MANAGER_TUP.address, TOKEN_MANAGER.abi, provider.getSigner());
      let allAssets = state.assets;
      let allLevelLpAssets = state.levelLpAssets;
      let allBalancerLpAssets = state.balancerLpAssets;
      let allGmxV2Assets = state.gmxV2Assets;
      const dataRefreshNotificationService = rootState.serviceRegistry.dataRefreshEventService;

      async function setExposures(assets) {
        for (let symbol of Object.keys(assets)) {
          let asset = assets[symbol];

          if (asset.groupIdentifier) {
            const decimals = asset.decimals;

            const exposure = await tokenManager.groupToExposure(toBytes32(asset.groupIdentifier));

            asset.currentExposure = parseFloat(formatUnits(exposure.current, decimals));
            asset.maxExposure = parseFloat(formatUnits(exposure.max, decimals));

            dataRefreshNotificationService.emitAssetUpdatedEvent(asset);
          }
        }
      }

      await setExposures(allAssets);
      commit('setAssets', allAssets);

      if (allBalancerLpAssets) {
        await setExposures(allBalancerLpAssets);
        commit('setBalancerLpAssets', allBalancerLpAssets);
      }

      if (allLevelLpAssets) {
        await setExposures(allLevelLpAssets);
        commit('setLevelLpAssets', allLevelLpAssets);
      }

      if (allGmxV2Assets) {
        await setExposures(allGmxV2Assets);
        commit('setGmxV2Assets', allGmxV2Assets);
      }
    },

    async setupLpAssets({state, rootState, commit}) {
      const lpService = rootState.serviceRegistry.lpService;
      let lpTokens = {};

      Object.values(config.LP_ASSETS_CONFIG).forEach(
        asset => {
          if (state.supportedAssets.includes(asset.symbol)) {
            lpTokens[asset.symbol] = asset;
          }
        }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(lpTokens).forEach(async assetSymbol => {
        lpTokens[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
        lpService.emitRefreshLp();
      });

      commit('setLpAssets', lpTokens);
    },

    async setupConcentratedLpAssets({state, rootState, commit}) {
      const lpService = rootState.serviceRegistry.lpService;
      let lpTokens = {};

      Object.values(config.CONCENTRATED_LP_ASSETS_CONFIG).forEach(
        asset => {
          if (state.supportedAssets.includes(asset.symbol)) {
            lpTokens[asset.symbol] = asset;
          }
        }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(lpTokens).forEach(async assetSymbol => {
        lpTokens[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
        lpService.emitRefreshLp();
      });

      commit('setConcentratedLpAssets', lpTokens);
    },

    async setupTraderJoeV2LpAssets({state, rootState, commit}) {
      const traderJoeService = rootState.serviceRegistry.traderJoeService;
      let lpTokens = {};

      Object.values(config.TRADERJOEV2_LP_ASSETS_CONFIG).forEach(async asset => {
        // To-do: check if the assets supported. correct symbols if not.
        lpTokens[asset.symbol] = asset;

        try {
          const rewardsInfo = await traderJoeService.getRewardsInfo(state.smartLoanContract.address, asset.address);

          lpTokens[asset.symbol]['rewardsInfo'] = rewardsInfo;
        } catch (error) {
          console.log(`fetching climable rewards error: ${error}`);
        }
      });

      // To-do: request price of TJLB token prices from Redstone

      commit('setTraderJoeV2LpAssets', lpTokens);
    },

    async setupLevelLpAssets({state, rootState, commit}) {
      const lpService = rootState.serviceRegistry.lpService;
      let lpTokens = {};

      Object.values(config.LEVEL_LP_ASSETS_CONFIG).forEach(
        asset => {
          if (state.supportedAssets.includes(asset.symbol)) {
            lpTokens[asset.symbol] = asset;
          }
        }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(lpTokens).forEach(async assetSymbol => {
        lpTokens[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
        lpService.emitRefreshLp();
      });

      commit('setLevelLpAssets', lpTokens);
    },

    async setupBalancerLpAssets({state, rootState, commit}) {
      const lpService = rootState.serviceRegistry.lpService;
      let lpTokens = {};

      Object.values(config.BALANCER_LP_ASSETS_CONFIG).forEach(
          asset => {
            //TODO: bring back
            // if (state.supportedAssets.includes(asset.symbol)) {
              lpTokens[asset.symbol] = asset;
            // }
          }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(lpTokens).forEach(async assetSymbol => {
        lpTokens[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
        lpService.emitRefreshLp();
      });

      commit('setBalancerLpAssets', lpTokens);
    },

    async setupGmxV2Assets({state, rootState, commit}) {
      const lpService = rootState.serviceRegistry.lpService;
      let lpTokens = {};

      Object.values(config.GMX_V2_ASSETS_CONFIG).forEach(
          asset => {
            if (state.supportedAssets.includes(asset.symbol)) {
              lpTokens[asset.symbol] = asset;
            }
          }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(lpTokens).forEach(async assetSymbol => {
        lpTokens[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
        lpService.emitRefreshLp();
      });

      commit('setGmxV2Assets', lpTokens);
    },


    async setupContracts({rootState, commit}) {
      const smartLoanFactoryContract = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner());
      const wrappedTokenContract = new ethers.Contract(config.WRAPPED_TOKEN_ADDRESS, wrappedAbi, provider.getSigner());
      let readProvider = new ethers.providers.JsonRpcProvider(config.readRpcUrl);
      const multicallContract = new ethers.Contract(config.multicallAddress, MULTICALL.abi, readProvider);

      commit('setSmartLoanFactoryContract', smartLoanFactoryContract);
      commit('setWrappedTokenContract', wrappedTokenContract);
      commit('setMulticallContract', multicallContract);
    },

    async setupSmartLoanContract({state, rootState, commit}) {
      const provider = rootState.network.provider;

      let smartLoanAddress;
      smartLoanAddress = await state.smartLoanFactoryContract.getLoanForOwner(rootState.network.account);

      if (router && router.currentRoute) {
        if (router.currentRoute.query.user) {
          smartLoanAddress = await state.smartLoanFactoryContract.getLoanForOwner(router.currentRoute.query.user);
        } else if (router.currentRoute.query.account) {
          smartLoanAddress = router.currentRoute.query.account;
        }
      }


      const smartLoanContract = new ethers.Contract(smartLoanAddress, SMART_LOAN.abi, provider.getSigner());

      let readProvider = new ethers.providers.JsonRpcProvider(config.readRpcUrl);
      const readSmartLoanContract = new ethers.Contract(smartLoanAddress, SMART_LOAN.abi, readProvider);

      commit('setReadSmartLoanContract', readSmartLoanContract);
      commit('setSmartLoanContract', smartLoanContract);
    },

    async createLoan({state, rootState}) {
      const provider = rootState.network.provider;

      if (!(await signMessage(provider, loanTermsToSign, rootState.network.account))) return;

      const transaction = (await wrapContract(state.smartLoanFactoryContract)).createLoan();

      await awaitConfirmation(transaction, provider, 'createLoan');
    },

    async createLoanAndDeposit({state, rootState, commit}, {request}) {
      const provider = rootState.network.provider;
      const amountInWei = parseUnits(request.value.toString(), request.assetDecimals);

      if (!(await signMessage(provider, loanTermsToSign, rootState.network.account))) return;

      const transaction = await (await wrapContract(state.smartLoanFactoryContract)).createLoan();

      let tx = await awaitConfirmation(transaction, provider, 'create loan');

      const smartLoanAddress = getLog(tx, SMART_LOAN_FACTORY.abi, 'SmartLoanCreated').args.accountAddress;

      const fundToken = new ethers.Contract(request.assetAddress, erc20ABI, provider.getSigner());

      const allowance = formatUnits(await fundToken.allowance(rootState.network.account, smartLoanAddress), request.assetDecimals);

      if (parseFloat(allowance) < parseFloat(request.value)) {
        const approveTransaction = await fundToken.connect(provider.getSigner()).approve(smartLoanAddress, amountInWei);

        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const smartLoanContract = new ethers.Contract(smartLoanAddress, SMART_LOAN.abi, provider.getSigner());

      const fundTx = request.asset === 'GLP' ?
        await smartLoanContract.fundGLP(
          amountInWei)
        :
        await smartLoanContract.fund(
          toBytes32(request.asset),
          amountInWei);


      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      tx = await awaitConfirmation(fundTx, provider, 'deposit');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      const depositedAmount = getLog(tx, SMART_LOAN.abi, 'Funded').args.amount;
      const decimals = config.ASSETS_CONFIG[request.asset].decimals;

      const amount = formatUnits(depositedAmount, BigNumber.from(decimals));
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(request.asset, amount, false, true);
      const depositAmountUSD = Number(amount) * state.assets[request.asset].price;
      rootState.serviceRegistry.collateralService.emitCollateral(depositAmountUSD);

      await commit('setSingleAssetBalance', {asset: request.asset, balance: amount});
      commit('setNoSmartLoan', false);
    },

    async createAndFundLoan({state, rootState, commit, dispatch}, {asset, value, isLP}) {
      const provider = rootState.network.provider;
      const nativeAssetOptions = config.NATIVE_ASSET_TOGGLE_OPTIONS;

      if (!(await signMessage(provider, loanTermsToSign, rootState.network.account))) return;

      //TODO: make it more robust
      if (asset === nativeAssetOptions[0]) {
        asset = config.ASSETS_CONFIG[nativeAssetOptions[0]];
        let depositTransaction = await state.wrappedTokenContract.deposit({value: toWei(String(value))});
        await awaitConfirmation(depositTransaction, provider, 'deposit');
      }

      if (asset === nativeAssetOptions[1]) {
        asset = config.ASSETS_CONFIG[nativeAssetOptions[0]];
      }

      const decimals = config.ASSETS_CONFIG[asset.symbol].decimals;
      const amount = parseUnits(String(value), decimals);
      const fundTokenContract = new ethers.Contract(TOKEN_ADDRESSES[asset.symbol], erc20ABI, provider.getSigner());

      const allowance = formatUnits(await fundTokenContract.allowance(rootState.network.account, state.smartLoanFactoryContract.address), decimals);

      if (parseFloat(allowance) < parseFloat(value)) {
        const approveTransaction = await fundTokenContract.approve(state.smartLoanFactoryContract.address, amount);
        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const wrappedSmartLoanFactoryContract = await wrapContract(state.smartLoanFactoryContract);

      const transaction = config.chainId === 43114 ?
        await wrappedSmartLoanFactoryContract.createAndFundLoan(toBytes32(asset.symbol), fundTokenContract.address, amount)
        : await wrappedSmartLoanFactoryContract.createAndFundLoan(toBytes32(asset.symbol), amount);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      const tx = await awaitConfirmation(transaction, provider, 'create Prime Account');

      const fundAmount = formatUnits(getLog(tx, SMART_LOAN_FACTORY.abi, 'SmartLoanCreated').args.collateralAmount, decimals);
      const fundAmountUSD = Number(fundAmount) * state.assets[asset.symbol].price;

      await commit('setSingleAssetBalance', {asset: asset.symbol, balance: fundAmount});
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(asset, fundAmount, isLP, true);
      rootState.serviceRegistry.collateralService.emitCollateral(fundAmountUSD);

      commit('setNoSmartLoan', false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      await dispatch('setupSmartLoanContract');
      // TODO check on mainnet
      setTimeout(async () => {
        await dispatch('network/updateBalance', {}, {root: true});
        rootState.serviceRegistry.healthService.emitRefreshHealth();
      }, 5000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 30000);
    },

    async getAllAssetsBalances({state, commit, rootState, dispatch}) {
      const dataRefreshNotificationService = rootState.serviceRegistry.dataRefreshEventService;
      const balances = {};
      const lpBalances = {};
      const concentratedLpBalances = {};
      const gmxV2Balances = {};
      const balancerLpBalances = {};
      const levelLpBalances = {};
      const assetBalances = await state.readSmartLoanContract.getAllAssetsBalances();
      assetBalances.forEach(
        asset => {
          let symbol = fromBytes32(asset.name);
          if (config.ASSETS_CONFIG[symbol]) {
            balances[symbol] = formatUnits(asset.balance.toString(), config.ASSETS_CONFIG[symbol].decimals);
          }
          if (config.LP_ASSETS_CONFIG[symbol]) {
            lpBalances[symbol] = formatUnits(asset.balance.toString(), config.LP_ASSETS_CONFIG[symbol].decimals);
          }
          if (config.CONCENTRATED_LP_ASSETS_CONFIG[symbol]) {
            concentratedLpBalances[symbol] = formatUnits(asset.balance.toString(), config.CONCENTRATED_LP_ASSETS_CONFIG[symbol].decimals);
          }
          if (config.BALANCER_LP_ASSETS_CONFIG[symbol]) {
            balancerLpBalances[symbol] = formatUnits(asset.balance.toString(), config.BALANCER_LP_ASSETS_CONFIG[symbol].decimals);
          }
          if (config.GMX_V2_ASSETS_CONFIG[symbol]) {
            gmxV2Balances[symbol] = formatUnits(asset.balance.toString(), config.GMX_V2_ASSETS_CONFIG[symbol].decimals);
          }
        }
      );

      if (config.LEVEL_LP_ASSETS_CONFIG) {
        let result = await state.multicallContract.callStatic.aggregate(
          Object.entries(config.LEVEL_LP_ASSETS_CONFIG).map(
            ([key, value]) => {
              return {
                target: state.readSmartLoanContract.address,
                callData: state.readSmartLoanContract.interface.encodeFunctionData(value.balanceMethod)
              }
            })
        );

        Object.keys(config.LEVEL_LP_ASSETS_CONFIG).forEach(
          (key, index) => {
            levelLpBalances[key] = fromWei(result.returnData[index]);
          }
        )
        console.warn('MULTICALL result');
        console.log(result);
      }

      await commit('setAssetBalances', balances);
      await commit('setLpBalances', lpBalances);
      await commit('setConcentratedLpBalances', concentratedLpBalances);
      await commit('setBalancerLpBalances', balancerLpBalances);
      await commit('setLevelLpBalances', levelLpBalances);
      await commit('setGmxV2Balances', gmxV2Balances);
      await dispatch('setupConcentratedLpUnderlyingBalances');
      await dispatch('setupTraderJoeV2LpUnderlyingBalancesAndLiquidity');
      const refreshEvent = {assetBalances: balances, lpBalances: lpBalances};
      dataRefreshNotificationService.emitAssetBalancesDataRefresh();
      dataRefreshNotificationService.emitAssetBalancesDataRefreshEvent(refreshEvent);
    },

    async setupConcentratedLpUnderlyingBalances({state, commit, rootState}) {
      const concentratedLpAssets = state.concentratedLpAssets;

      const requests = []
      const abi = ['function getUnderlyingAssets(uint256) public view returns (uint256, uint256)'];
      console.log(state.concentratedLpAssets);
      // noinspection ES6MissingAwait
      Object.keys(state.concentratedLpAssets).forEach(async assetSymbol => {
        const poolContract = await new ethers.Contract(concentratedLpAssets[assetSymbol].address, abi, provider.getSigner());
        const poolBalance = toWei(state.concentratedLpBalances[assetSymbol].toString());
        requests.push({
          target: concentratedLpAssets[assetSymbol].address,
          callData: poolContract.interface.encodeFunctionData('getUnderlyingAssets', [poolBalance])
        })
      })

      const response = await multicallContract.callStatic.aggregate(requests);
      console.log('MULTI RESPONSE LEVEL');
      console.log(response);


      // noinspection ES6MissingAwait
      Object.keys(state.concentratedLpAssets).forEach(async assetSymbol => {
        console.log(assetSymbol);
        const abi = ['function getUnderlyingAssets(uint256) public view returns (uint256, uint256)'];
        const poolContract = await new ethers.Contract(concentratedLpAssets[assetSymbol].address, abi, provider.getSigner());
        const poolBalance = toWei(state.concentratedLpBalances[assetSymbol].toString());

        const balances = await poolContract.getUnderlyingAssets(poolBalance);
        console.log(balances);

        concentratedLpAssets[assetSymbol].primaryBalance = formatUnits(balances[0], state.assets[concentratedLpAssets[assetSymbol].primary].decimals);
        concentratedLpAssets[assetSymbol].secondaryBalance = formatUnits(balances[1], state.assets[concentratedLpAssets[assetSymbol].secondary].decimals);

        const lpService = rootState.serviceRegistry.lpService;
        lpService.emitRefreshLp();
      });
    },

    async fetchTraderJoeV2LpUnderlyingBalances({state}, {lbPairAddress, binIds, lpToken}) {
      const poolContract = new ethers.Contract(lbPairAddress, LB_PAIR.abi, provider.getSigner());

      let cumulativeTokenXAmount = BigNumber.from(0);
      let cumulativeTokenYAmount = BigNumber.from(0);

      let accountBalances = [];
      let accountBalancesPrimary = [];
      let accountBalancesSecondary = [];
      let binBalancePrimary = [];
      let binBalanceSecondary = [];
      let binTotalSupply = [];


      const requests = [];
      // noinspection ES6MissingAwait
      binIds.forEach(async binId => {
        requests.push(...[
          {
            target: poolContract.address,
            callData: poolContract.interface.encodeFunctionData('balanceOf', [state.smartLoanContract.address, binId]),
            name: `${binId}.balanceOf`
          },
          {
            target: poolContract.address,
            callData: poolContract.interface.encodeFunctionData('getBin', [binId]),
            name: `${binId}.getBin`
          },
          {
            target: poolContract.address,
            callData: poolContract.interface.encodeFunctionData('totalSupply', [binId]),
            name: `${binId}.totalSupply`
          }]
        );

      })


      const response = await multicallContract.callStatic.aggregate(requests);

      const binsData = [];
      for (let i = 0; i < response.returnData.length; i += 3) {
        binsData.push({
          lbTokenAmount: decodeOutput(LB_PAIR.abi, 'balanceOf', response.returnData[i]),
          reserves: decodeOutput(LB_PAIR.abi, 'getBin', response.returnData[i + 1]),
          totalSupply: decodeOutput(LB_PAIR.abi, 'totalSupply', response.returnData[i + 2]),
        })
      }

      binsData.forEach((binData, i) => {
        const lbTokenAmount = binData.lbTokenAmount[0];
        const reserves = binData.reserves;
        const totalSupply = binData.totalSupply[0];

        const binTokenXAmount = BigNumber.from(lbTokenAmount).mul(BigNumber.from(reserves[0])).div(BigNumber.from(totalSupply));
        const binTokenYAmount = BigNumber.from(lbTokenAmount).mul(BigNumber.from(reserves[1])).div(BigNumber.from(totalSupply));

        cumulativeTokenXAmount = cumulativeTokenXAmount.add(binTokenXAmount);
        cumulativeTokenYAmount = cumulativeTokenYAmount.add(binTokenYAmount);

        accountBalances[i] = fromWei(lbTokenAmount);
        accountBalancesPrimary[i] = formatUnits(binTokenXAmount, state.assets[lpToken.primary].decimals);
        accountBalancesSecondary[i] = formatUnits(binTokenYAmount, state.assets[lpToken.secondary].decimals);
        binBalancePrimary[i] = formatUnits(reserves[0], state.assets[lpToken.primary].decimals);
        binBalanceSecondary[i] = formatUnits(reserves[1], state.assets[lpToken.secondary].decimals);
        binTotalSupply[i] = fromWei(totalSupply);
      })

      return {
        cumulativeTokenXAmount,
        cumulativeTokenYAmount,
        accountBalances,
        accountBalancesPrimary,
        accountBalancesSecondary,
        binBalancePrimary,
        binBalanceSecondary,
        binTotalSupply
      }
    },

    async refreshTraderJoeV2LpUnderlyingBalancesAndLiquidity({state, dispatch, rootState}, {lpAsset}) {
      const loanAllBins = await state.readSmartLoanContract.getOwnedTraderJoeV2Bins();
      const loanBinsForPair = loanAllBins.filter(bin =>
        bin.pair.toLowerCase() === lpAsset.address.toLowerCase()
      );
      const loanBinIds = loanBinsForPair.map(bin => bin.id);
      loanBinIds.sort((a, b) => a - b);

      const {
        cumulativeTokenXAmount,
        cumulativeTokenYAmount,
        accountBalances,
        accountBalancesPrimary,
        accountBalancesSecondary,
        binBalancePrimary,
        binBalanceSecondary,
        binTotalSupply
      } = await dispatch("fetchTraderJoeV2LpUnderlyingBalances", {
        lbPairAddress: lpAsset.address,
        binIds: loanBinIds,
        lpToken: lpAsset
      });

      let primaryToken = state.assets[lpAsset.primary];
      let secondaryToken = state.assets[lpAsset.secondary];

      let binPrices = loanBinIds.map(id => getBinPrice(id, lpAsset.binStep, primaryToken.decimals, secondaryToken.decimals))

      lpAsset.primaryBalance = formatUnits(cumulativeTokenXAmount, primaryToken.decimals);
      lpAsset.secondaryBalance = formatUnits(cumulativeTokenYAmount, secondaryToken.decimals);
      lpAsset.binIds = loanBinIds; // bin Ids where loan has liquidity for a LB pair
      lpAsset.accountBalances = accountBalances; // balances of account owned bins (the same order as binIds)
      lpAsset.accountBalancesPrimary = accountBalancesPrimary; // balances of account owned bins (the same order as binIds)
      lpAsset.accountBalancesSecondary = accountBalancesSecondary; // balances of account owned bins (the same order as binIds)
      lpAsset.binPrices = binPrices; // price assigned to each bin
      lpAsset.binBalancePrimary = binBalancePrimary; // price assigned to each bin
      lpAsset.binBalanceSecondary = binBalanceSecondary; // price assigned to each bin
      lpAsset.binTotalSupply = binTotalSupply; // price assigned to each bin

      const lpService = rootState.serviceRegistry.lpService;
      lpService.emitRefreshLp('TJV2');
    },

    async setupTraderJoeV2LpUnderlyingBalancesAndLiquidity({state, dispatch, rootState}) {
      const traderJoeV2LpAssets = state.traderJoeV2LpAssets;

      Object.keys(traderJoeV2LpAssets).forEach(async assetSymbol => {
        const lpAsset = traderJoeV2LpAssets[assetSymbol];

        await dispatch("refreshTraderJoeV2LpUnderlyingBalancesAndLiquidity", {lpAsset});
      });
    },

    async getAllAssetsApys({state, commit, rootState}) {
      const dataRefreshNotificationService = rootState.serviceRegistry.dataRefreshEventService;

      let assets = state.assets;
      const apys = state.apys;

      for (let [symbol, asset] of Object.entries(assets)) {
        // we don't use getApy method anymore, but fetch APYs from db
        if (apys[symbol] && apys[symbol].apy) {
          assets[symbol].apy = window.chain == 'arbitrum' ? apys[symbol].arbApy : apys[symbol].apy;
        }
      }

      commit('setAssets', assets);

      let lpAssets = state.lpAssets;

      for (let [symbol, lpAsset] of Object.entries(lpAssets)) {
        // we don't use getApy method anymore, but fetch APYs from db
        if (apys[symbol] && apys[symbol].lp_apy) {
          lpAssets[symbol].apy = apys[symbol].lp_apy;
        }
      }

      commit('setLpAssets', lpAssets);

      let concentratedLpAssets = state.concentratedLpAssets;

      //TODO: replace with for logic
      try {
        concentratedLpAssets['SHLB_AVAX-USDC_B'].apy = apys['AVAX_USDC'].apy * 100;
        concentratedLpAssets['SHLB_USDT.e-USDt_C'].apy = apys['USDT.e_USDt'].apy * 100;
        concentratedLpAssets['SHLB_BTC.b-AVAX_B'].apy = 0;
        concentratedLpAssets['SHLB_EUROC-USDC_V2_1_B'].apy = apys['EUROC_USDC'].apy * 100;
      } catch (e) {
        console.log(e);
      }

      commit('setConcentratedLpAssets', concentratedLpAssets);

      let traderJoeV2LpAssets = state.traderJoeV2LpAssets;

      if (Object.keys(traderJoeV2LpAssets).length !== 0) {
        for (let [symbol, traderJoeV2LpAsset] of Object.entries(traderJoeV2LpAssets)) {
          // we don't use getApy method anymore, but fetch APYs from db
          if (apys[symbol] && apys[symbol].lp_apy) {
            traderJoeV2LpAssets[symbol].apy = apys[symbol].lp_apy * 100;
          }

          if (traderJoeV2LpAssets['TJLB_MAGIC_ETH']) {
            traderJoeV2LpAssets['TJLB_MAGIC_ETH'].apy = 114.81;
          }
        }
      }
      commit('setTraderJoeV2LpAssets', traderJoeV2LpAssets);

      let balancerLpAssets = state.balancerLpAssets;

      console.log('apys')
      console.log(apys)
      console.log(balancerLpAssets)
      if (balancerLpAssets) {
        if (Object.keys(balancerLpAssets).length !== 0) {
          for (let [symbol, asset] of Object.entries(balancerLpAssets)) {
            // we don't use getApy method anymore, but fetch APYs from db
            if (apys[symbol] && apys[symbol].lp_apy) {
              balancerLpAssets[symbol].apy = apys[symbol].lp_apy * 100;
            }
          }
        }

        commit('setBalancerLpAssets', balancerLpAssets);
      }

      let levelLpAssets = state.levelLpAssets;

      if (levelLpAssets) {
        if (Object.keys(levelLpAssets).length !== 0) {
          for (let [symbol, asset] of Object.entries(levelLpAssets)) {
            // we don't use getApy method anymore, but fetch APYs from db
            if (apys[symbol] && apys[symbol][symbol]) {
              levelLpAssets[symbol].apy = apys[symbol][symbol];
            }
          }
        }

        commit('setLevelLpAssets', levelLpAssets);
      }

      let gmxV2Assets = state.gmxV2Assets;

      if (gmxV2Assets) {
        if (Object.keys(gmxV2Assets).length !== 0) {
          for (let [symbol, asset] of Object.entries(gmxV2Assets)) {
            if (apys[symbol] && apys[symbol].lp_apy) {
              gmxV2Assets[symbol].apy = apys[symbol].lp_apy * 100;
            }
          }
        }

        commit('setGmxV2Assets', gmxV2Assets);
      }

      dataRefreshNotificationService.emitAssetApysDataRefresh();
    },

    async getDebtsPerAsset({state, commit, rootState}) {
      const dataRefreshNotificationService = rootState.serviceRegistry.dataRefreshEventService;
      const debtsPerAsset = {};
      const debts = await state.readSmartLoanContract.getDebts();
      debts.forEach(debt => {
        const asset = fromBytes32(debt.name);
        if (config.ASSETS_CONFIG[asset]) {
          const debtValue = formatUnits(debt.debt, config.ASSETS_CONFIG[asset].decimals);
          debtsPerAsset[asset] = {asset: asset, debt: debtValue};
        }
      });
      await commit('setDebtsPerAsset', debtsPerAsset);
      dataRefreshNotificationService.emitDebtsPerAssetDataRefreshEvent(debtsPerAsset);
      rootState.serviceRegistry.healthService.emitRefreshHealth();
    },

    async getFullLoanStatus({state, rootState, commit}) {
      let result;

      try {
        result = await state.multicallContract.callStatic.aggregate(
          [
            {
              target: state.smartLoanContract.address,
              callData: state.readSmartLoanContract.interface.encodeFunctionData('getAllOwnedAssets')
            },
            {
              target: state.smartLoanContract.address,
              callData: state.readSmartLoanContract.interface.encodeFunctionData('getStakedPositions')
            }
          ]
        );
      } catch (e) {
        console.log('error')
        console.log(e)
      }

      let owned = decodeOutput(SMART_LOAN.abi, 'getAllOwnedAssets', result.returnData[0])[0];
      let staked = decodeOutput(SMART_LOAN.abi, 'getStakedPositions', result.returnData[1])[0];

      const loanAssets = mergeArrays([
        owned.map(el => fromBytes32(el)),
        staked.map(el => {
          return fromBytes32(el[1])
        }),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const fullLoanStatusResponse = await (await wrapContract(state.readSmartLoanContract, loanAssets)).getFullLoanStatus();

      const fullLoanStatus = {
        totalValue: fromWei(fullLoanStatusResponse[0]),
        debt: fromWei(fullLoanStatusResponse[1]),
        thresholdWeightedValue: fromWei(fullLoanStatusResponse[2]),
        health: fromWei(fullLoanStatusResponse[3]),
      };

      const collateral = fullLoanStatus.totalValue - fullLoanStatus.debt;

      commit('setFullLoanStatus', fullLoanStatus);
      rootState.serviceRegistry.dataRefreshEventService.emitFullLoanStatusRefresh();
      rootState.serviceRegistry.collateralService.emitCollateral(collateral);
      rootState.serviceRegistry.debtService.emitDebt(fullLoanStatus.debt);
    },

    async getAccountApr({state, getters, rootState, commit}) {
      let apr = 0;
      let yearlyDebtInterest = 0;

      if (rootState.poolStore.pools && state.debtsPerAsset) {
        Object.entries(state.debtsPerAsset).forEach(
          ([symbol, debt]) => {
            const pool = rootState.poolStore.pools.find(pool => pool.asset.symbol === symbol);
            if (pool) {
              yearlyDebtInterest += parseFloat(debt.debt) * pool.borrowingAPY * state.assets[symbol].price;
            }
          }
        );

        let yearlyAssetInterest = 0;

        if (state.assets && state.assetBalances) {
          for (let entry of Object.entries(state.assets)) {
            let symbol = entry[0];
            let asset = entry[1];

            //TODO: take from API
            const apy = asset.apy ? asset.apy / 100 : 0;
            yearlyAssetInterest += parseFloat(state.assetBalances[symbol]) * apy * asset.price;
          }
        }

        let yearlyLpInterest = 0;

        if (state.lpAssets && state.lpBalances) {
          for (let entry of Object.entries(state.lpAssets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];

            //TODO: take from API
            let assetAppreciation = (lpAsset.primary === 'sAVAX' || lpAsset.secondary === 'sAVAX') ? 1.036 : 1;
            const apy = lpAsset.apy ? lpAsset.apy / 100 : 0;

            yearlyLpInterest += parseFloat(state.lpBalances[symbol]) * (((1 + apy) * assetAppreciation) - 1) * lpAsset.price;
          }
        }

        if (state.concentratedLpAssets && state.concentratedLpBalances) {
          for (let entry of Object.entries(state.concentratedLpAssets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];

            const apy = lpAsset.apy ? lpAsset.apy / 100 : 0;

            yearlyLpInterest += parseFloat(state.concentratedLpBalances[symbol]) * apy * lpAsset.price;
          }
        }

        if (state.levelLpAssets && state.levelLpBalances) {
          for (let entry of Object.entries(state.levelLpAssets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];

            const apy = lpAsset.apy ? lpAsset.apy / 100 : 0;

            yearlyLpInterest += parseFloat(state.levelLpBalances[symbol]) * apy * lpAsset.price;
          }
        }

        if (state.gmxV2Assets && state.gmxV2Balances) {
          for (let entry of Object.entries(state.gmxV2Assets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];

            const apy = lpAsset.apy ? lpAsset.apy / 100 : 0;

            yearlyLpInterest += parseFloat(state.gmxV2Balances[symbol]) * apy * lpAsset.price;
          }

          let gmWorth = 0;

          Object.keys(config.GMX_V2_ASSETS_CONFIG).forEach(
              gmSymbol => gmWorth += state.gmxV2Balances[gmSymbol] * state.gmxV2Assets[gmSymbol].price
          );

          let collateral = state.fullLoanStatus.totalValue - state.fullLoanStatus.debt;

          let leveragedGm = gmWorth - collateral > 0 ? gmWorth - collateral : 0;

          yearlyLpInterest += leveragedGm * state.apys['GM_BOOST'].arbApy;
        }

        let yearlyTraderJoeV2Interest = 0;

        if (state.traderJoeV2LpAssets) {
          for (let entry of Object.entries(state.traderJoeV2LpAssets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];

            const apy = lpAsset.apy ? lpAsset.apy / 100 : 0;
            const userValueInPool =
              state.assets[lpAsset.primary].price * lpAsset.primaryBalance
              + state.assets[lpAsset.secondary].price * lpAsset.secondaryBalance;

            yearlyTraderJoeV2Interest += userValueInPool * apy;
          }
        }

        let yearlyFarmInterest = 0;

        if (rootState.stakeStore.farms) {
          for (let entry of Object.entries(rootState.stakeStore.farms)) {
            let symbol = entry[0];
            let farms = entry[1];

            for (let farm of farms) {
              let assetAppretiation = 1;

              if (symbol.includes('sAVAX')) assetAppretiation = 1.036;
              if (symbol === 'sAVAX') assetAppretiation = 1.072;

              let farmApy = 0;

              farmApy = farm.currentApy ? farm.currentApy : 0;

              let asset = rootState.fundsStore.assets[symbol] ? rootState.fundsStore.assets[symbol] : rootState.fundsStore.lpAssets[symbol];
              let assetApy = (asset.apy && symbol !== 'GLP') ? asset.apy / 100 : 0;

              const cumulativeApy = farm.isTokenLp ? (((1 + assetApy + farmApy) * assetAppretiation) - 1) : (1 + assetApy) * (1 + farmApy) - 1;
              yearlyFarmInterest += parseFloat(farm.totalBalance) * cumulativeApy * farm.price;
            }
          }
        }

        const collateral = getters.getCollateral;

        if (collateral) {
          apr = (yearlyAssetInterest + yearlyLpInterest + yearlyFarmInterest + yearlyTraderJoeV2Interest - yearlyDebtInterest) / collateral;
        }

        commit('setAccountApr', apr);

        rootState.serviceRegistry.aprService.emitRefreshApr();
      }
    },

    async swapToWavax({state, rootState}) {
      const provider = rootState.network.provider;
      await state.wrappedTokenContract.connect(provider.getSigner()).deposit({value: toWei('1000')});
    },

    async fund({state, rootState, commit, dispatch}, {fundRequest}) {
      const provider = rootState.network.provider;
      const amountInWei = parseUnits(fundRequest.value.toString(), fundRequest.assetDecimals);

      const tokenForApprove = (fundRequest.asset === 'GLP' && config.chainId === 43114) ? '0xaE64d55a6f09E4263421737397D1fdFA71896a69' : TOKEN_ADDRESSES[fundRequest.asset];
      const fundToken = new ethers.Contract(tokenForApprove, erc20ABI, provider.getSigner());

      const allowance = formatUnits(await fundToken.allowance(rootState.network.account, state.smartLoanContract.address), fundRequest.assetDecimals);

      if (parseFloat(allowance) < parseFloat(fundRequest.value)) {
        const approveTransaction = await fundToken.connect(provider.getSigner()).approve(state.smartLoanContract.address, amountInWei);
        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [fundRequest.asset]
      ]);

      // Note - temporary code to remove 'ARBI' from data feed request to Redstone
      if (window.chain === 'arbitrum') {
        const arbiTokenIndex = loanAssets.indexOf('ARBI');
        loanAssets.splice(arbiTokenIndex, 1);
      }

      const isGlp = fundRequest.asset === 'GLP';
      const isLevel = ['arbJnrLLP', 'arbMzeLLP', 'arbSnrLLP'].includes(fundRequest.asset);

      const transaction =
        isGlp ?
          await (await wrapContract(state.smartLoanContract, loanAssets)).fundGLP(
            amountInWei)
          :
          isLevel ?
            await (await wrapContract(state.smartLoanContract, loanAssets)).depositLLPAndStake(fundRequest.pid, amountInWei)
            :
            await (await wrapContract(state.smartLoanContract, loanAssets)).fund(
              toBytes32(fundRequest.asset),
              amountInWei);


      if (!fundRequest.keepModalOpen) {
        rootState.serviceRegistry.progressBarService.requestProgressBar();
        rootState.serviceRegistry.modalService.closeModal();
      }

      let tx = await awaitConfirmation(transaction, provider, 'fund');

      const depositAmount = formatUnits(getLog(tx, SMART_LOAN.abi, isLevel ? 'DepositedLLP' : 'Funded').args[isLevel ? 'depositAmount' : 'amount'], fundRequest.assetDecimals);

      let price;
      switch (fundRequest.type) {
        case 'ASSET':
          price = state.assets[fundRequest.asset].price;
          break;
        case 'LP':
          price = state.lpAssets[fundRequest.asset].price;
          break;
        case 'CONCENTRATED_LP':
          price = state.concentratedLpAssets[fundRequest.asset].price;
          break;
        case 'LEVEL_LLP':
          price = state.levelLpAssets[fundRequest.asset].price;
      }

      const depositAmountUSD = Number(depositAmount) * price;
      const totalCollateralAfterTransaction = state.fullLoanStatus.totalValue - state.fullLoanStatus.debt + depositAmountUSD;
      let assetBalanceBeforeDeposit;
      switch (fundRequest.type) {
        case 'ASSET':
          assetBalanceBeforeDeposit = state.assetBalances[fundRequest.asset];
          break;
        case 'LP':
          assetBalanceBeforeDeposit = state.lpBalances[fundRequest.asset];
          break;
        case 'CONCENTRATED_LP':
          assetBalanceBeforeDeposit = state.concentratedLpBalances[fundRequest.asset];
          break;
        case 'LEVEL_LLP':
          assetBalanceBeforeDeposit = state.levelLpBalances[fundRequest.asset];
      }
      const assetBalanceAfterDeposit = Number(assetBalanceBeforeDeposit) + Number(depositAmount);

      if (fundRequest.type == 'ASSET') {
        await commit('setSingleAssetBalance', {asset: fundRequest.asset, balance: assetBalanceAfterDeposit});
        commit('setSingleAssetCurrentExposure', {asset: fundRequest.asset, exposureChange: Number(depositAmount)});
      }

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(fundRequest.asset, assetBalanceAfterDeposit, Boolean(fundRequest.isLP), true);
      rootState.serviceRegistry.collateralService.emitCollateral(totalCollateralAfterTransaction);


      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async fundNativeToken({state, rootState, commit, dispatch}, {value}) {
      const provider = rootState.network.provider;
      const nativeAssetOptions = config.NATIVE_ASSET_TOGGLE_OPTIONS;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [config.nativeToken]
      ]);

      // Note - temporary code to remove 'ARBI' from data feed request to Redstone
      if (window.chain === 'arbitrum') {
        const arbiTokenIndex = loanAssets.indexOf('ARBI');
        loanAssets.splice(arbiTokenIndex, 1);
      }

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).depositNativeToken({
        value: toWei(String(value)),
      });

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();
      let tx = await awaitConfirmation(transaction, provider, 'fund');
      const depositAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'DepositNative').args.amount, config.ASSETS_CONFIG[nativeAssetOptions[0]].decimals);
      const depositAmountUSD = Number(depositAmount) * state.assets[nativeAssetOptions[0]].price;
      const collateralAfterTransaction = state.fullLoanStatus.totalValue - state.fullLoanStatus.debt + depositAmountUSD;
      const assetBalanceAfterDeposit = Number(state.assetBalances[nativeAssetOptions[0]]) + Number(depositAmount);

      await commit('setSingleAssetBalance', {asset: nativeAssetOptions[0], balance: assetBalanceAfterDeposit});
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(nativeAssetOptions[0], assetBalanceAfterDeposit, false, true);
      rootState.serviceRegistry.collateralService.emitCollateral(collateralAfterTransaction);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async withdraw({state, rootState, commit, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([
        (await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      if (window.chain === 'arbitrum') {
        // Note - temporary code to remove 'ARBI' from data feed request to Redstone
        const arbiTokenIndex = loanAssets.indexOf('ARBI');
        loanAssets.splice(arbiTokenIndex, 1);
      }

      const isGlp = withdrawRequest.asset === 'GLP';
      const isLevel = ['arbJnrLLP', 'arbMzeLLP', 'arbSnrLLP'].includes(withdrawRequest.asset);

      const amountInWei = parseUnits(parseFloat(withdrawRequest.value).toFixed(withdrawRequest.assetDecimals), withdrawRequest.assetDecimals);

      const transaction = isGlp ?
        await (await wrapContract(state.smartLoanContract, loanAssets)).withdrawGLP(
          parseUnits(String(withdrawRequest.value)))
        :
        isLevel ?
          await (await wrapContract(state.smartLoanContract, loanAssets)).unstakeAndWithdrawLLP(withdrawRequest.pid, amountInWei)
          :
          await (await wrapContract(state.smartLoanContract, loanAssets)).withdraw(
            toBytes32(withdrawRequest.asset),
            amountInWei);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'withdraw');


      const withdrawAmount = formatUnits(getLog(tx, SMART_LOAN.abi, isLevel ? 'WithdrewLLP' : 'Withdrawn').args[isLevel ? 'depositAmount' : 'amount'], withdrawRequest.assetDecimals);

      let price;
      switch (withdrawRequest.type) {
        case 'ASSET':
          price = state.assets[withdrawRequest.asset].price;
          break;
        case 'LP':
          price = state.lpAssets[withdrawRequest.asset].price;
          break;
        case 'CONCENTRATED_LP':
          price = state.concentratedLpAssets[withdrawRequest.asset].price;
          break;
        case 'LEVEL_LLP':
          price = state.levelLpAssets[withdrawRequest.asset].price;
      }
      const withdrawAmountUSD = Number(withdrawAmount) * price;

      let assetBalanceBeforeWithdraw;
      switch (withdrawRequest.type) {
        case 'ASSET':
          assetBalanceBeforeWithdraw = state.assetBalances[withdrawRequest.asset];
          break;
        case 'LP':
          assetBalanceBeforeWithdraw = state.lpBalances[withdrawRequest.asset];
          break;
        case 'CONCENTRATED_LP':
          assetBalanceBeforeWithdraw = state.concentratedLpBalances[withdrawRequest.asset];
          break;
        case 'LEVEL_LLP':
          assetBalanceBeforeWithdraw = state.levelLpBalances[withdrawRequest.asset];
      }
      const assetBalanceAfterWithdraw = Number(assetBalanceBeforeWithdraw) - Number(withdrawAmount);
      const totalCollateralAfterTransaction = state.fullLoanStatus.totalValue - state.fullLoanStatus.debt - withdrawAmountUSD;


      if (withdrawRequest.type == 'ASSET') {
        await commit('setSingleAssetBalance', {asset: withdrawRequest.asset, balance: assetBalanceAfterWithdraw});
        commit('setSingleAssetCurrentExposure', {
          asset: withdrawRequest.asset,
          exposureChange: -Number(withdrawAmount)
        });
      }

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(withdrawRequest.asset, assetBalanceAfterWithdraw, withdrawRequest.isLP, true);
      rootState.serviceRegistry.collateralService.emitCollateral(totalCollateralAfterTransaction);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async withdrawNativeToken({state, rootState, commit, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;
      const nativeAssetOptions = config.NATIVE_ASSET_TOGGLE_OPTIONS;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets))
        .unwrapAndWithdraw(parseUnits(String(withdrawRequest.value), withdrawRequest.assetDecimals));

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'withdraw');
      const withdrawAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'UnwrapAndWithdraw').args.amount, config.ASSETS_CONFIG[nativeAssetOptions[0]].decimals);
      const withdrawAmountUSD = Number(withdrawAmount) * state.assets[nativeAssetOptions[0]].price;

      const assetBalanceAfterWithdraw = Number(state.assetBalances[nativeAssetOptions[0]]) - Number(withdrawAmount);
      const totalCollateralAfterTransaction = state.fullLoanStatus.totalValue - state.fullLoanStatus.debt - withdrawAmountUSD;

      await commit('setSingleAssetBalance', {asset: nativeAssetOptions[0], balance: assetBalanceAfterWithdraw});
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(nativeAssetOptions[0], assetBalanceAfterWithdraw, false, true);
      rootState.serviceRegistry.collateralService.emitCollateral(totalCollateralAfterTransaction);


      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async provideLiquidity({state, rootState, commit, dispatch}, {provideLiquidityRequest}) {
      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.secondAsset].decimals;
      const lpTokenDecimals = config.LP_ASSETS_CONFIG[provideLiquidityRequest.symbol].decimals;

      let minAmount = 0.9;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [provideLiquidityRequest.symbol]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract[config.DEX_CONFIG[provideLiquidityRequest.dex].addLiquidityMethod](
        toBytes32(provideLiquidityRequest.firstAsset),
        toBytes32(provideLiquidityRequest.secondAsset),
        parseUnits(parseFloat(provideLiquidityRequest.firstAmount).toFixed(firstDecimals), BigNumber.from(firstDecimals.toString())),
        parseUnits(parseFloat(provideLiquidityRequest.secondAmount).toFixed(secondDecimals), BigNumber.from(secondDecimals.toString())),
        parseUnits((minAmount * parseFloat(provideLiquidityRequest.firstAmount)).toFixed(firstDecimals), BigNumber.from(firstDecimals.toString())),
        parseUnits((minAmount * parseFloat(provideLiquidityRequest.secondAmount)).toFixed(secondDecimals), BigNumber.from(secondDecimals.toString()))
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create LP token');

      const firstAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'AddLiquidity').args.firstAmount, firstDecimals); // how much of tokenA was used
      const secondAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'AddLiquidity').args.secondAmount, secondDecimals); //how much of tokenB was used
      const lpTokenCreated = formatUnits(getLog(tx, SMART_LOAN.abi, 'AddLiquidity').args.liquidity, lpTokenDecimals); //how much LP was created
      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[provideLiquidityRequest.firstAsset]) - Number(firstAssetAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[provideLiquidityRequest.secondAsset]) - Number(secondAssetAmount);
      const lpTokenBalanceAfterTransaction = Number(state.lpBalances[provideLiquidityRequest.symbol]) + Number(lpTokenCreated);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.symbol, lpTokenBalanceAfterTransaction, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async removeLiquidity({state, rootState, commit, dispatch}, {removeLiquidityRequest}) {

      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.secondAsset].decimals;
      const lpTokenDecimals = config.LP_ASSETS_CONFIG[removeLiquidityRequest.symbol].decimals;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.firstAsset, removeLiquidityRequest.secondAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract[config.DEX_CONFIG[removeLiquidityRequest.dex].removeLiquidityMethod](
        toBytes32(removeLiquidityRequest.firstAsset),
        toBytes32(removeLiquidityRequest.secondAsset),
        parseUnits(removePaddedTrailingZeros(removeLiquidityRequest.value), BigNumber.from(removeLiquidityRequest.assetDecimals.toString())),
        parseUnits((removeLiquidityRequest.minFirstAmount), BigNumber.from(firstDecimals.toString())),
        parseUnits((removeLiquidityRequest.minSecondAmount), BigNumber.from(secondDecimals.toString()))
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'unwind LP token');

      const firstAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'RemoveLiquidity').args.firstAmount, firstDecimals); // how much of tokenA was received
      const secondAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'RemoveLiquidity').args.secondAmount, secondDecimals); //how much of tokenB was received
      const lpTokenRemoved = formatUnits(getLog(tx, SMART_LOAN.abi, 'RemoveLiquidity').args.liquidity, lpTokenDecimals); //how much LP was removed
      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.firstAsset]) + Number(firstAssetAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.secondAsset]) + Number(secondAssetAmount);
      const lpTokenBalanceAfterTransaction = Number(state.lpBalances[removeLiquidityRequest.symbol]) - Number(lpTokenRemoved);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.symbol, lpTokenBalanceAfterTransaction, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async provideLiquidityConcentratedPool({state, rootState, commit, dispatch}, {provideLiquidityRequest}) {
      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.secondAsset].decimals;
      const lpTokenDecimals = config.CONCENTRATED_LP_ASSETS_CONFIG[provideLiquidityRequest.symbol].decimals;

      let minAmount = 0;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [provideLiquidityRequest.symbol]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract[provideLiquidityRequest.method](
        parseUnits(parseFloat(provideLiquidityRequest.firstAmount).toFixed(firstDecimals), BigNumber.from(firstDecimals.toString())),
        parseUnits(parseFloat(provideLiquidityRequest.secondAmount).toFixed(secondDecimals), BigNumber.from(secondDecimals.toString())),
        parseUnits((minAmount * parseFloat(provideLiquidityRequest.firstAmount)).toFixed(firstDecimals), BigNumber.from(firstDecimals.toString())),
        parseUnits((minAmount * parseFloat(provideLiquidityRequest.secondAmount)).toFixed(secondDecimals), BigNumber.from(secondDecimals.toString()))
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create concentrated LP token');

      const firstAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Staked').args.depositTokenAmount0, firstDecimals); // how much of tokenA was used
      const secondAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Staked').args.depositTokenAmount1, secondDecimals); //how much of tokenB was used
      const lpTokenCreated = formatUnits(getLog(tx, SMART_LOAN.abi, 'Staked').args.receiptTokenAmount, lpTokenDecimals); //how much LP was created


      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[provideLiquidityRequest.firstAsset]) - Number(firstAssetAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[provideLiquidityRequest.secondAsset]) - Number(secondAssetAmount);
      const lpTokenBalanceAfterTransaction = Number(state.concentratedLpBalances[provideLiquidityRequest.symbol]) + Number(lpTokenCreated);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.symbol, lpTokenBalanceAfterTransaction, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async removeLiquidityConcentratedPool({state, rootState, commit, dispatch}, {removeLiquidityRequest}) {

      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.secondAsset].decimals;
      const lpTokenDecimals = config.CONCENTRATED_LP_ASSETS_CONFIG[removeLiquidityRequest.symbol].decimals;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.firstAsset, removeLiquidityRequest.secondAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract[removeLiquidityRequest.method](
        parseUnits(removePaddedTrailingZeros(removeLiquidityRequest.value), BigNumber.from(removeLiquidityRequest.assetDecimals.toString())),
        parseUnits((removeLiquidityRequest.minFirstAmount), BigNumber.from(firstDecimals.toString())),
        parseUnits((removeLiquidityRequest.minSecondAmount), BigNumber.from(secondDecimals.toString()))
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'unwind LP token');

      const firstAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Unstaked').args.depositTokenAmount0, firstDecimals); // how much of tokenA was received
      const secondAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Unstaked').args.depositTokenAmount1, secondDecimals); //how much of tokenB was received
      const lpTokenRemoved = formatUnits(getLog(tx, SMART_LOAN.abi, 'Unstaked').args.receiptTokenAmount, lpTokenDecimals); //how much LP was removed
      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.firstAsset]) + Number(firstAssetAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.secondAsset]) + Number(secondAssetAmount);
      const lpTokenBalanceAfterTransaction = Number(state.concentratedLpBalances[removeLiquidityRequest.symbol]) - Number(lpTokenRemoved);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.symbol, lpTokenBalanceAfterTransaction, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async fundLiquidityTraderJoeV2Pool({state, rootState, commit, dispatch}, {fundLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const lbTokenContract = new ethers.Contract(
        fundLiquidityRequest.pair,
        LB_TOKEN.abi,
        provider.getSigner()
      );

      const isApprovedForAll = await lbTokenContract.isApprovedForAll(rootState.network.account, state.smartLoanContract.address);

      if (!isApprovedForAll) {
        const approveTransaction = await lbTokenContract.approveForAll(state.smartLoanContract.address, true);

        await approveTransaction.wait();
      }

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract.fundLiquidityTraderJoeV2(
        fundLiquidityRequest.pair,
        fundLiquidityRequest.ids,
        fundLiquidityRequest.amounts
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'deposit TraderJoe V2 LP token');

      const {cumulativeTokenXAmount, cumulativeTokenYAmount} = await dispatch("fetchTraderJoeV2LpUnderlyingBalances", {
        lbPairAddress: fundLiquidityRequest.pair,
        binIds: fundLiquidityRequest.ids,
        lpToken: fundLiquidityRequest.lpToken
      });

      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[fundLiquidityRequest.firstAsset]) - Number(formatUnits(cumulativeTokenXAmount, state.assets[fundLiquidityRequest.firstAsset].decimals));
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[fundLiquidityRequest.secondAsset]) - Number(formatUnits(cumulativeTokenYAmount, state.assets[fundLiquidityRequest.secondAsset].decimals));

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(fundLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(fundLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);

      const lpAsset = state.traderJoeV2LpAssets[fundLiquidityRequest.lpToken.symbol];
      await dispatch("refreshTraderJoeV2LpUnderlyingBalancesAndLiquidity", {lpAsset});

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },


    async withdrawLiquidityTraderJoeV2Pool({state, rootState, commit, dispatch}, {withdrawLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract.withdrawLiquidityTraderJoeV2(
        withdrawLiquidityRequest.pair,
        withdrawLiquidityRequest.ids,
        withdrawLiquidityRequest.amounts
      );

      const lpAsset = state.traderJoeV2LpAssets[withdrawLiquidityRequest.lpToken.symbol];
      await dispatch("refreshTraderJoeV2LpUnderlyingBalancesAndLiquidity", {lpAsset});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'withdraw TraderJoe V2 LP token');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },


    async addLiquidityTraderJoeV2Pool({state, rootState, commit, dispatch}, {addLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [addLiquidityRequest.symbol]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract[addLiquidityRequest.method](
        addLiquidityRequest.addLiquidityInput
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create TraderJoe v2 LP token');

      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[addLiquidityRequest.firstAsset]) - Number(formatUnits(addLiquidityRequest.firstAmount, addLiquidityRequest.firstAsset.decimals));
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[addLiquidityRequest.secondAsset]) - Number(formatUnits(addLiquidityRequest.secondAmount, addLiquidityRequest.secondAsset.decimals));

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(addLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(addLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);

      // update underlying assets' balances
      const lpAsset = state.traderJoeV2LpAssets[addLiquidityRequest.symbol];
      await dispatch("refreshTraderJoeV2LpUnderlyingBalancesAndLiquidity", {lpAsset});

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async removeLiquidityTraderJoeV2Pool({state, rootState, dispatch}, {removeLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.firstAsset, removeLiquidityRequest.secondAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract[removeLiquidityRequest.method](
        removeLiquidityRequest.removeLiquidityInput
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'unwind traderjoe v2 token');

      const {cumulativeTokenXAmount, cumulativeTokenYAmount} = await dispatch("fetchTraderJoeV2LpUnderlyingBalances", {
        lbPairAddress: removeLiquidityRequest.lbPairAddress,
        binIds: removeLiquidityRequest.remainingBinIds,
        lpToken: removeLiquidityRequest.lpToken
      });
      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.firstAsset]) + Number(formatUnits(cumulativeTokenXAmount, state.assets[removeLiquidityRequest.firstAsset].decimals));
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.secondAsset]) + Number(formatUnits(cumulativeTokenYAmount, state.assets[removeLiquidityRequest.secondAsset].decimals));

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);

      const lpAsset = state.traderJoeV2LpAssets[removeLiquidityRequest.symbol];
      await dispatch("refreshTraderJoeV2LpUnderlyingBalancesAndLiquidity", {lpAsset});

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async claimTraderJoeRewards({state, rootState, dispatch}, {claimRewardsRequest}) {
      console.log('claimRewardsRequest')
      console.log(claimRewardsRequest)
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
          await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract.claimReward(claimRewardsRequest.merkleEntries);
      rootState.serviceRegistry.progressBarService.requestProgressBar();
      const tx = await awaitConfirmation(transaction, provider, 'claim rewards from traderjoe v2 pools');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      rootState.serviceRegistry.modalService.closeModal();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async addLiquidityLevelFinance({state, rootState, commit, dispatch}, {addLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [addLiquidityRequest.sourceAsset, addLiquidityRequest.targetAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      let sourceDecimals = config.ASSETS_CONFIG[addLiquidityRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(addLiquidityRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.LEVEL_LP_ASSETS_CONFIG[addLiquidityRequest.targetAsset].decimals;
      let targetAmount = parseUnits(addLiquidityRequest.targetAmount.toFixed(targetDecimals), targetDecimals);

      const transaction = await wrappedContract[addLiquidityRequest.method](
        sourceAmount,
        targetAmount,
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create Level LLP token');

      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[addLiquidityRequest.sourceAsset]) - Number(addLiquidityRequest.sourceAmount);
      const secondAssetBalanceAfterTransaction = Number(state.levelLpBalances[addLiquidityRequest.targetAsset]) + Number(addLiquidityRequest.targetAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(addLiquidityRequest.sourceAsset, firstAssetBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(addLiquidityRequest.targetAsset, secondAssetBalanceAfterTransaction, true, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async removeLiquidityLevelFinance({state, rootState, dispatch}, {removeLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.sourceAsset, removeLiquidityRequest.targetAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      let sourceDecimals = config.LEVEL_LP_ASSETS_CONFIG[removeLiquidityRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(removeLiquidityRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.targetAsset].decimals;
      let targetAmount = parseUnits(removeLiquidityRequest.targetAmount.toFixed(targetDecimals), targetDecimals);

      const transaction = await wrappedContract[removeLiquidityRequest.method](
        sourceAmount,
        targetAmount,
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'remove liquidity from LLp');

      const firstAssetBalanceAfterTransaction = Number(state.levelLpBalances[removeLiquidityRequest.sourceAsset]) - Number(removeLiquidityRequest.sourceAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.targetAsset]) + Number(removeLiquidityRequest.targetAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.sourceAsset, firstAssetBalanceAfterTransaction, true, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.targetAsset, secondAssetBalanceAfterTransaction, false, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async claimLevelRewards({state, rootState, dispatch}, {claimRewardsRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).harvestRewards(claimRewardsRequest.lpToken.pid);

      rootState.serviceRegistry.progressBarService.requestProgressBar();

      const tx = await awaitConfirmation(transaction, provider, 'harvestRewards');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      rootState.serviceRegistry.modalService.closeModal();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async addLiquidityGmxV2({state, rootState, commit, dispatch}, {addLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
          await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [addLiquidityRequest.sourceAsset, addLiquidityRequest.targetAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      let sourceDecimals = config.ASSETS_CONFIG[addLiquidityRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(addLiquidityRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.GMX_V2_ASSETS_CONFIG[addLiquidityRequest.targetAsset].decimals;

      let minGmAmount = parseUnits(addLiquidityRequest.minGmAmount.toFixed(targetDecimals), targetDecimals);

      let executionFeeWei = toWei(addLiquidityRequest.executionFee.toFixed(18));

      console.log('addLiquidityRequest.method: ', addLiquidityRequest.method)
      const transaction = await wrappedContract[addLiquidityRequest.method](
          addLiquidityRequest.isLongToken,
          sourceAmount,
          minGmAmount,
          executionFeeWei,
          { value: executionFeeWei}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create GM token');

      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[addLiquidityRequest.sourceAsset]) - Number(addLiquidityRequest.tokenAmount);
      const secondAssetBalanceAfterTransaction = Number(state.gmxV2Balances[addLiquidityRequest.targetAsset]) + Number(addLiquidityRequest.minGmAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
          .emitExternalAssetBalanceUpdate(addLiquidityRequest.sourceAsset, firstAssetBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
          .emitExternalAssetBalanceUpdate(addLiquidityRequest.targetAsset, secondAssetBalanceAfterTransaction, true, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async removeLiquidityGmxV2({state, rootState, dispatch}, {removeLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
          await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.sourceAsset, removeLiquidityRequest.targetAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      console.log('removeLiquidityRequest')
      console.log(removeLiquidityRequest)
      let gmDecimals = config.GMX_V2_ASSETS_CONFIG[removeLiquidityRequest.gmToken].decimals;
      let gmAmount = parseUnits(parseFloat(removeLiquidityRequest.gmAmount).toFixed(gmDecimals), gmDecimals);

      let shortDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.shortToken].decimals;
      let minShortAmount = parseUnits(removeLiquidityRequest.minShortAmount.toFixed(shortDecimals), shortDecimals);

      let longDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.longToken].decimals;
      let minLongAmount = parseUnits(removeLiquidityRequest.minLongAmount.toFixed(longDecimals), longDecimals);

      let executionFeeWei = toWei(removeLiquidityRequest.executionFee.toFixed(18));

      const transaction = await wrappedContract[removeLiquidityRequest.method](
          gmAmount,
          minLongAmount,
          minShortAmount,
          executionFeeWei,
          { value: executionFeeWei}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'remove liquidity from LLp');

      const gmBalanceAfterTransaction = Number(state.gmxV2Balances[removeLiquidityRequest.gmToken]) - Number(removeLiquidityRequest.gmAmount);
      const longAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.longToken]) - Number(removeLiquidityRequest.minLongAmount);
      const shortAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.shortToken]) + Number(removeLiquidityRequest.minShortAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
          .emitExternalAssetBalanceUpdate(removeLiquidityRequest.gmToken, gmBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
          .emitExternalAssetBalanceUpdate(removeLiquidityRequest.longToken, longAssetBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
          .emitExternalAssetBalanceUpdate(removeLiquidityRequest.shortToken, shortAssetBalanceAfterTransaction, false, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async borrow({state, rootState, commit, dispatch}, {borrowRequest}) {
      console.log('borrowRequest', borrowRequest);
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [borrowRequest.asset]
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).borrow(
        toBytes32(borrowRequest.asset),
        parseUnits(String(borrowRequest.amount), config.ASSETS_CONFIG[borrowRequest.asset].decimals));

      if (!borrowRequest.keepModalOpen) {
        rootState.serviceRegistry.progressBarService.requestProgressBar();
        rootState.serviceRegistry.modalService.closeModal();
      }

      let tx = await awaitConfirmation(transaction, provider, 'borrow');
      const borrowedAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Borrowed').args.amount, config.ASSETS_CONFIG[borrowRequest.asset].decimals);
      const balanceAfterTransaction = Number(state.assetBalances[borrowRequest.asset]) + Number(borrowedAmount);
      const debtAfterTransaction = Number(state.debtsPerAsset[borrowRequest.asset].debt) + Number(borrowedAmount);
      const borrowedAmountUSD = Number(borrowedAmount) * Number(state.assets[borrowRequest.asset].price);
      const totalDebtAfterTransaction = Number(state.fullLoanStatus.debt) + borrowedAmountUSD;

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(borrowRequest.asset, balanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetDebtsExternalUpdateService
        .emitExternalAssetDebtUpdate(borrowRequest.asset, debtAfterTransaction, true);
      rootState.serviceRegistry.debtService.emitDebt(totalDebtAfterTransaction);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('poolStore/setupPools', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async repay({state, rootState, commit, dispatch}, {repayRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).repay(
        toBytes32(repayRequest.asset),
        parseUnits(parseFloat(repayRequest.amount).toFixed(repayRequest.decimals), BigNumber.from(repayRequest.decimals)));

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'repay');

      const repayAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Repaid').args.amount, config.ASSETS_CONFIG[repayRequest.asset].decimals);
      const repayAmountUSD = Number(repayAmount) * Number(state.assets[repayRequest.asset].price);

      const balanceAfterRepay = Number(state.assetBalances[repayRequest.asset]) - Number(repayAmount);
      const debtAfterRepay = repayRequest.isMax ? 0 : Number(state.debtsPerAsset[repayRequest.asset].debt) - Number(repayAmount);
      const totalDebtAfterRepay = Number(state.fullLoanStatus.debt - repayAmountUSD);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(repayRequest.asset, balanceAfterRepay, false, true);
      rootState.serviceRegistry.assetDebtsExternalUpdateService
        .emitExternalAssetDebtUpdate(repayRequest.asset, debtAfterRepay, true);
      rootState.serviceRegistry.debtService.emitDebt(totalDebtAfterRepay);

      commit('setSingleAssetBalance', {asset: repayRequest.asset, balance: balanceAfterRepay});
      commit('setSingleAssetDebt', {asset: repayRequest.asset, debt: debtAfterRepay});

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('poolStore/setupPools', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async swap({state, rootState, commit, dispatch}, {swapRequest}) {
      console.log('swapRequest', swapRequest);
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [swapRequest.targetAsset]
      ]);

      let sourceDecimals = config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(swapRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.ASSETS_CONFIG[swapRequest.targetAsset].decimals;
      let targetAmount = parseUnits(swapRequest.targetAmount.toFixed(targetDecimals), targetDecimals);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).yakSwap(
        sourceAmount,
        targetAmount,
        swapRequest.path,
        swapRequest.adapters
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'swap');

      const amountSold = formatUnits(getLog(tx, SMART_LOAN.abi, 'Swap').args.maximumSold, config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals);
      const amountBought = formatUnits(getLog(tx, SMART_LOAN.abi, 'Swap').args.minimumBought, config.ASSETS_CONFIG[swapRequest.targetAsset].decimals);
      const sourceBalanceAfterSwap = Number(state.assetBalances[swapRequest.sourceAsset]) - Number(amountSold);
      const targetBalanceAfterSwap = Number(state.assetBalances[swapRequest.targetAsset]) + Number(amountBought);

      commit('setSingleAssetBalance', {asset: swapRequest.sourceAsset, balance: sourceBalanceAfterSwap});
      commit('setSingleAssetBalance', {asset: swapRequest.targetAsset, balance: targetBalanceAfterSwap});
      commit('setSingleAssetCurrentExposure', {asset: swapRequest.sourceAsset, exposureChange: -Number(amountSold)});
      commit('setSingleAssetCurrentExposure', {asset: swapRequest.targetAsset, exposureChange: Number(amountBought)});

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(swapRequest.sourceAsset, sourceBalanceAfterSwap, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(swapRequest.targetAsset, targetBalanceAfterSwap, false, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async paraSwap({state, rootState, commit, dispatch}, {swapRequest}) {
      const provider = rootState.network.provider;

      console.log(swapRequest);

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [swapRequest.targetAsset]
      ]);

      const wrappedLoan = await wrapContract(state.smartLoanContract, loanAssets);

      let sourceDecimals = config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(swapRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.ASSETS_CONFIG[swapRequest.targetAsset].decimals;
      let targetAmount = parseUnits(swapRequest.targetAmount.toFixed(targetDecimals), targetDecimals);

      const paraSwapSDK = constructSimpleSDK({chainId: config.chainId, axios});

      const transactionParams = await paraSwapSDK.swap.buildTx({
        srcToken: swapRequest.paraSwapRate.srcToken,
        destToken: swapRequest.paraSwapRate.destToken,
        srcAmount: swapRequest.paraSwapRate.srcAmount,
        destAmount: swapRequest.paraSwapRate.destAmount,
        priceRoute: swapRequest.paraSwapRate,
        userAddress: wrappedLoan.address,
        partner: 'anon',
      }, {
        ignoreChecks: true,
      });
      console.log(transactionParams);
      const swapData = paraSwapRouteToSimpleData(transactionParams);


      console.log(swapData);

      const transaction = await wrappedLoan.paraSwap(swapData);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      const tx = await awaitConfirmation(transaction, provider, 'paraSwap');

      console.log('SWAP LOG');
      console.log(getLog(tx, SMART_LOAN.abi, 'Swap'));

      const amountSold = formatUnits(getLog(tx, SMART_LOAN.abi, 'Swap').args.maximumSold, config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals);
      const amountBought = formatUnits(getLog(tx, SMART_LOAN.abi, 'Swap').args.minimumBought, config.ASSETS_CONFIG[swapRequest.targetAsset].decimals);
      const sourceBalanceAfterSwap = Number(state.assetBalances[swapRequest.sourceAsset]) - Number(amountSold);
      const targetBalanceAfterSwap = Number(state.assetBalances[swapRequest.targetAsset]) + Number(amountBought);

      commit('setSingleAssetBalance', {asset: swapRequest.sourceAsset, balance: sourceBalanceAfterSwap});
      commit('setSingleAssetBalance', {asset: swapRequest.targetAsset, balance: targetBalanceAfterSwap});

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(swapRequest.sourceAsset, sourceBalanceAfterSwap, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(swapRequest.targetAsset, targetBalanceAfterSwap, false, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      console.log(tx);
    },

    async swapDebt({state, rootState, commit, dispatch}, {swapDebtRequest}) {
      const provider = rootState.network.provider;
      console.log('swapDebtRequest', swapDebtRequest);

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [swapDebtRequest.targetAsset]
      ]);

      let sourceDecimals = config.ASSETS_CONFIG[swapDebtRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(swapDebtRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.ASSETS_CONFIG[swapDebtRequest.targetAsset].decimals;
      let targetAmount = parseUnits(parseFloat(swapDebtRequest.targetAmount).toFixed(targetDecimals), targetDecimals);

      const reversedSwapPath = [...swapDebtRequest.path].reverse();

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).swapDebt(
        toBytes32(swapDebtRequest.sourceAsset),
        toBytes32(swapDebtRequest.targetAsset),
        sourceAmount,
        targetAmount,
        reversedSwapPath,
        swapDebtRequest.adapters
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'swap');

      const amountDebtSwappedTo = formatUnits(getLog(tx, SMART_LOAN.abi, 'DebtSwap').args.borrowAmount, config.ASSETS_CONFIG[swapDebtRequest.targetAsset].decimals);
      const amountDebtSwappedFrom = formatUnits(getLog(tx, SMART_LOAN.abi, 'DebtSwap').args.repayAmount, config.ASSETS_CONFIG[swapDebtRequest.sourceAsset].decimals);

      const sourceDebtAfterTransaction = Number(state.debtsPerAsset[swapDebtRequest.sourceAsset].debt) - Number(amountDebtSwappedFrom);
      const targetDebtAfterTransaction = Number(state.debtsPerAsset[swapDebtRequest.targetAsset].debt) + Number(amountDebtSwappedTo);

      rootState.serviceRegistry.assetDebtsExternalUpdateService
        .emitExternalAssetDebtUpdate(swapDebtRequest.sourceAsset, sourceDebtAfterTransaction, true);
      rootState.serviceRegistry.assetDebtsExternalUpdateService
        .emitExternalAssetDebtUpdate(swapDebtRequest.targetAsset, targetDebtAfterTransaction, true);

      const borrowedAmountUSD = Number(amountDebtSwappedTo) * Number(state.assets[swapDebtRequest.targetAsset].price);
      const repaidAmountUSD = Number(amountDebtSwappedFrom) * Number(state.assets[swapDebtRequest.sourceAsset].price);

      const totalDebtAfterTransaction = Number(state.fullLoanStatus.debt) + borrowedAmountUSD - repaidAmountUSD;

      rootState.serviceRegistry.debtService.emitDebt(totalDebtAfterTransaction);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async mintAndStakeGlp({state, rootState, commit, dispatch}, {mintAndStakeGlpRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        ['GLP']
      ]);

      let sourceDecimals = config.ASSETS_CONFIG[mintAndStakeGlpRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(mintAndStakeGlpRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      const weiDecimals = BigNumber.from('18');
      let minUsdValue = parseUnits(parseFloat(mintAndStakeGlpRequest.minUsdValue).toFixed(18), weiDecimals);
      let minGlp = parseUnits(parseFloat(mintAndStakeGlpRequest.minGlp).toFixed(18), weiDecimals);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).mintAndStakeGlp(
        TOKEN_ADDRESSES[mintAndStakeGlpRequest.sourceAsset],
        sourceAmount,
        minUsdValue,
        minGlp
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'mint GLP');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      const amountUsed = formatUnits(getLog(tx, SMART_LOAN.abi, 'GLPMint').args.tokenToMintWithAmount, config.ASSETS_CONFIG[mintAndStakeGlpRequest.sourceAsset].decimals);
      const amountMinted = formatUnits(getLog(tx, SMART_LOAN.abi, 'GLPMint').args.glpOutputAmount, weiDecimals);

      const sourceBalanceAfterMint = Number(state.assetBalances[mintAndStakeGlpRequest.sourceAsset]) - Number(amountUsed);
      const glpBalanceAfterMint = Number(state.assetBalances['GLP']) + Number(amountMinted);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(mintAndStakeGlpRequest.sourceAsset, sourceBalanceAfterMint, false, true);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('GLP', glpBalanceAfterMint, false, true);

      rootState.serviceRegistry.dataRefreshEventService.emitAssetBalancesDataRefresh();
    },

    async unstakeAndRedeemGlp({state, rootState, commit, dispatch}, {unstakeAndRedeemGlpRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [unstakeAndRedeemGlpRequest.targetAsset]
      ]);

      const weiDecimals = BigNumber.from('18');
      let targetDecimals = config.ASSETS_CONFIG[unstakeAndRedeemGlpRequest.targetAsset].decimals;
      let targetAmount = parseUnits(parseFloat(unstakeAndRedeemGlpRequest.targetAmount).toFixed(targetDecimals), targetDecimals);
      let glpAmount = parseUnits(parseFloat(unstakeAndRedeemGlpRequest.glpAmount).toFixed(18), weiDecimals);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).unstakeAndRedeemGlp(
        TOKEN_ADDRESSES[unstakeAndRedeemGlpRequest.targetAsset],
        glpAmount,
        targetAmount
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'redeem GLP');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      const amountReceived = formatUnits(getLog(tx, SMART_LOAN.abi, 'GLPRedemption').args.redeemedTokenAmount, config.ASSETS_CONFIG[unstakeAndRedeemGlpRequest.targetAsset].decimals);
      const amountGlpRedeemed = formatUnits(getLog(tx, SMART_LOAN.abi, 'GLPRedemption').args.glpRedeemedAmount, weiDecimals);

      const targetBalanceAfterMint = Number(state.assetBalances[unstakeAndRedeemGlpRequest.targetAsset]) + Number(amountReceived);
      const glpBalanceAfterMint = Number(state.assetBalances['GLP']) - Number(amountGlpRedeemed);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(unstakeAndRedeemGlpRequest.targetAsset, targetBalanceAfterMint, false, true);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('GLP', glpBalanceAfterMint, false, true);

      rootState.serviceRegistry.dataRefreshEventService.emitAssetBalancesDataRefresh();
    },

    async wrapNativeToken({state, rootState, commit, dispatch}, {wrapRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).wrapNativeToken(
        parseUnits(parseFloat(wrapRequest.amount).toFixed(wrapRequest.decimals)));

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'wrap');

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async claimGLPRewards({state, rootState, dispatch}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).claimGLpFees();

      rootState.serviceRegistry.progressBarService.requestProgressBar();

      const tx = await awaitConfirmation(transaction, provider, 'claimGLPRewards');
      const wavaxClaimed = formatUnits(getLog(tx, SMART_LOAN.abi, 'GLPFeesClaim').args.wavaxAmountClaimed, config.ASSETS_CONFIG.AVAX.decimals);
      const balanceAfterClaimed = Number(state.assetBalances['AVAX']) + Number(wavaxClaimed);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('AVAX', balanceAfterClaimed, false, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      rootState.serviceRegistry.modalService.closeModal();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },
  }
};
