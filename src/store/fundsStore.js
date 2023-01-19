import {
  awaitConfirmation,
  isOracleError,
  signMessage,
  loanTermsToSign,
  wrapContract
} from '../utils/blockchain';
import SMART_LOAN from '@artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import DIAMOND_BEACON from '@contracts/SmartLoanDiamondBeacon.json';
import SMART_LOAN_FACTORY_TUP from '@contracts/SmartLoansFactoryTUP.json';
import SMART_LOAN_FACTORY from '@contracts/SmartLoansFactory.json';
import TOKEN_MANANGER from '@contracts/TokenManager.json';
import TOKEN_MANANGER_TUP from '@contracts/TokenManagerTUP.json';
import {formatUnits, fromWei, parseUnits, toWei} from '@/utils/calculate';
import config from '@/config';
import redstone from 'redstone-api';
import {BigNumber} from 'ethers';
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import {calculateHealth, mergeArrays, removePaddedTrailingZeros} from '../utils/calculate';
import wavaxAbi from '../../test/abis/WAVAX.json';
import erc20ABI from '../../test/abis/erc20.json';
import router from '@/router'


const toBytes32 = require('ethers').utils.formatBytes32String;
const fromBytes32 = require('ethers').utils.parseBytes32String;

const ethers = require('ethers');

const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdcTokenAddress = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';

const tokenAddresses = TOKEN_ADDRESSES;

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  namespaced: true,
  state: {
    assets: null,
    lpAssets: null,
    supportedAssets: null,
    provider: null,
    smartLoanContract: null,
    smartLoanFactoryContract: null,
    wavaxTokenContract: null,
    usdcTokenContract: null,
    assetBalances: null,
    lpBalances: null,
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
  },
  mutations: {
    setSmartLoanContract(state, smartLoanContract) {
      state.smartLoanContract = smartLoanContract;
    },

    setAssets(state, assets) {
      state.assets = assets;
    },

    setLpAssets(state, assets) {
      state.lpAssets = assets;
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

    setUsdcTokenContract(state, usdcTokenContract) {
      state.usdcTokenContract = usdcTokenContract;
    },

    setAssetBalances(state, assetBalances) {
      state.assetBalances = assetBalances;
    },

    setLpBalances(state, lpBalances) {
      state.lpBalances = lpBalances;
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

    setAccountApr(state, apr) {
      state.accountApr = apr;
    },
  },

  getters: {
    async getHealth(state, getters, rootState) {
      if (state.noSmartLoan) return 1;

      const redstonePriceDataRequest = await fetch('https://oracle-gateway-1.a.redstone.finance/data-packages/latest/redstone-avalanche-prod');
      const redstonePriceData = await redstonePriceDataRequest.json();

      if (state.debtsPerAsset && state.assets && state.assetBalances && state.lpAssets && state.lpBalances && rootState.stakeStore && rootState.stakeStore.farms) {
        let tokens = [];
        for (const [symbol, data] of Object.entries(state.assets)) {
          let borrowed = state.debtsPerAsset[symbol] ? parseFloat(state.debtsPerAsset[symbol].debt) : 0;

          tokens.push({
            price: redstonePriceData[symbol][0].dataPoints[0].value,
            balance: parseFloat(state.assetBalances[symbol]),
            borrowed: borrowed,
            debtCoverage: data.debtCoverage,
            symbol: symbol
          });
        }

        for (const [symbol, data] of Object.entries(state.lpAssets)) {
          tokens.push({
            price: redstonePriceData[symbol][0].dataPoints[0].value,
            balance: parseFloat(state.lpBalances[symbol]),
            borrowed: 0,
            debtCoverage: data.debtCoverage,
            symbol: symbol

          });
        }

        for (const [symbol, farms] of Object.entries(rootState.stakeStore.farms)) {
          farms.forEach(farm => {

            let feedSymbol = farm.feedSymbol ? farm.feedSymbol : symbol;

            tokens.push({
              price: redstonePriceData[feedSymbol][0].dataPoints[0].value,
              balance: parseFloat(farm.totalStaked),
              borrowed: 0,
              debtCoverage: farm.debtCoverage,
              symbol: symbol
            });
          });
        }

        const health = calculateHealth(tokens);

        return health >= 0 ? health : 0;
      }

      return 1;
    },
    getCollateral(state) {
      return state.fullLoanStatus.totalValue - state.fullLoanStatus.debt;
    },
  },

  actions: {
    async fundsStoreSetup({state, rootState, dispatch, commit}) {
      await dispatch('setupContracts');
      await dispatch('setupSmartLoanContract');
      await dispatch('setupSupportedAssets');
      await dispatch('setupAssets');
      await dispatch('setupLpAssets');
      await dispatch('stakeStore/updateStakedPrices', null, {root: true});
      state.assetBalances = [];

      const diamond = new ethers.Contract(DIAMOND_BEACON.address, DIAMOND_BEACON.abi, provider.getSigner());
      let isActive = await diamond.getStatus();
      await commit('setProtocolPaused', !isActive);

      if (state.smartLoanContract.address !== NULL_ADDRESS) {
        state.assetBalances = null;
        await dispatch('getAllAssetsBalances');
        await dispatch('stakeStore/updateStakedBalances', null, {root: true});
        await dispatch('getDebtsPerAsset');
        await dispatch('getAccountApr');
        try {
          await dispatch('getFullLoanStatus');
        } catch (e) {
          if (isOracleError(e)) await commit('setOracleError', true);
        }

        commit('setNoSmartLoan', false);
      } else {
        commit('setNoSmartLoan', true);
      }
      rootState.serviceRegistry.healthService.emitRefreshHealth();
    },

    async updateFunds({state, dispatch, commit, rootState}) {
      try {
        if (state.smartLoanContract.address !== NULL_ADDRESS) {
          commit('setNoSmartLoan', false);
        }
        await dispatch('setupAssets');
        await dispatch('setupLpAssets');
        await dispatch('getAllAssetsBalances');
        await dispatch('getDebtsPerAsset');
        await dispatch('getFullLoanStatus');
        await dispatch('stakeStore/updateStakedBalances', null, {root: true});
        await dispatch('getAccountApr');
        setTimeout(async () => {
          await dispatch('getFullLoanStatus');
        }, 5000);
        rootState.serviceRegistry.healthService.emitRefreshHealth();
      } catch (error) {
        console.error(error);
        console.error('ERROR DURING UPDATE FUNDS');
        console.log('refreshing page in 5s');
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      }
    },


    async setupSupportedAssets({commit}) {
      const tokenManager = new ethers.Contract(TOKEN_MANANGER_TUP.address, TOKEN_MANANGER.abi, provider.getSigner());
      const whiteListedTokenAddresses = await tokenManager.getSupportedTokensAddresses();

      const supported = whiteListedTokenAddresses.map(address => Object.keys(tokenAddresses).find(symbol => tokenAddresses[symbol].toLowerCase() === address.toLowerCase()));

      commit('setSupportedAssets', supported);
    },

    async setupAssets({state, commit}) {
      const nativeToken = Object.entries(config.ASSETS_CONFIG).find(asset => asset[0] === config.nativeToken);

      let assets = {};
      assets[nativeToken[0]] = nativeToken[1];

      Object.values(config.ASSETS_CONFIG).forEach(
        asset => {
          if (state.supportedAssets.includes(asset.symbol)) {
            assets[asset.symbol] = asset;
          }
        }
      );

      await redstone.getPrice(Object.keys(assets)).then(prices => {
        Object.keys(assets).forEach(assetSymbol => {
          assets[assetSymbol].price = prices[assetSymbol].value;
        });
      });
      commit('setAssets', assets);
    },

    async setupLpAssets({state, commit}) {
      let lpTokens = {};

      Object.values(config.LP_ASSETS_CONFIG).forEach(
        asset => {
          if (state.supportedAssets.includes(asset.symbol)) {
            lpTokens[asset.symbol] = asset;
          }
        }
      );

      await redstone.getPrice(Object.keys(lpTokens)).then(prices => {
        Object.keys(lpTokens).forEach(assetSymbol => {
          lpTokens[assetSymbol].price = prices[assetSymbol].value;
        });
      });
      commit('setLpAssets', lpTokens);
    },

    async setupContracts({rootState, commit}) {
      const provider = rootState.network.provider;

      const smartLoanFactoryContract = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner());
      const wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider.getSigner());
      const usdcTokenContract = new ethers.Contract(usdcTokenAddress, erc20ABI, provider.getSigner());

      commit('setSmartLoanFactoryContract', smartLoanFactoryContract);
      commit('setWavaxTokenContract', wavaxTokenContract);
      commit('setUsdcTokenContract', usdcTokenContract);
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

      commit('setSmartLoanContract', smartLoanContract);
    },

    async createLoan({state, rootState}) {
      const provider = rootState.network.provider;

      if (!(await signMessage(provider, loanTermsToSign, rootState.network.account))) return;

      const transaction = (await wrapContract(state.smartLoanFactoryContract)).createLoan({gasLimit: 8000000});

      await awaitConfirmation(transaction, provider, 'createLoan');
    },

    async createAndFundLoan({state, rootState, commit, dispatch}, {asset, value}) {
      const provider = rootState.network.provider;

      if (!(await signMessage(provider, loanTermsToSign, rootState.network.account))) return;

      //TODO: make it more robust
      if (asset === 'AVAX') {
        asset = config.ASSETS_CONFIG['AVAX'];
        let depositTransaction = await state.wavaxTokenContract.deposit({value: toWei(String(value))});
        await awaitConfirmation(depositTransaction, provider, 'deposit');
      }

      if (asset === 'WAVAX') {
        asset = config.ASSETS_CONFIG['AVAX'];
      }

      const decimals = config.ASSETS_CONFIG[asset.symbol].decimals;
      const amount = parseUnits(String(value), decimals);
      const fundTokenContract = new ethers.Contract(tokenAddresses[asset.symbol], erc20ABI, provider.getSigner());

      const allowance = formatUnits(await fundTokenContract.allowance(rootState.network.account, state.smartLoanFactoryContract.address), decimals);

      if (parseFloat(allowance) < parseFloat(value)) {
        const approveTransaction = await fundTokenContract.approve(state.smartLoanFactoryContract.address, amount);
        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const wrappedSmartLoanFactoryContract = await wrapContract(state.smartLoanFactoryContract);

      const transaction = await wrappedSmartLoanFactoryContract.createAndFundLoan(toBytes32(asset.symbol), fundTokenContract.address, amount, {gasLimit: 1000000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(transaction, provider, 'create Prime Account');
      await dispatch('setupSmartLoanContract');
      // TODO check on mainnet
      setTimeout(async () => {
        await dispatch('network/updateBalance', {}, {root: true});
      }, 5000);

      setTimeout(async () => {
        await dispatch('updateFunds');
        console.log('update funds after loan creation finished');
      }, 30000);
    },

    async getAllAssetsBalances({state, commit, rootState}) {
      const dataRefreshNotificationService = rootState.serviceRegistry.dataRefreshEventService;
      const balances = {};
      const lpBalances = {};
      const assetBalances = await state.smartLoanContract.getAllAssetsBalances();
      assetBalances.forEach(
        asset => {
          let symbol = fromBytes32(asset.name);
          if (config.ASSETS_CONFIG[symbol]) {
            balances[symbol] = formatUnits(asset.balance.toString(), config.ASSETS_CONFIG[symbol].decimals);
          }
          if (config.LP_ASSETS_CONFIG[symbol]) {
            lpBalances[symbol] = formatUnits(asset.balance.toString(), config.LP_ASSETS_CONFIG[symbol].decimals);
          }
        }
      );

      await commit('setAssetBalances', balances);
      await commit('setLpBalances', lpBalances);
      const refreshEvent = {assetBalances: balances, lpBalances: lpBalances};
      dataRefreshNotificationService.emitAssetBalancesDataRefreshEvent(refreshEvent);
    },

    async getDebtsPerAsset({state, commit, rootState}) {
      const dataRefreshNotificationService = rootState.serviceRegistry.dataRefreshEventService;
      const debtsPerAsset = {};
      const debts = await state.smartLoanContract.getDebts();
      debts.forEach(debt => {
        const asset = fromBytes32(debt.name);
        const debtValue = formatUnits(debt.debt, config.ASSETS_CONFIG[asset].decimals);
        debtsPerAsset[asset] = {asset: asset, debt: debtValue};
      });
      await commit('setDebtsPerAsset', debtsPerAsset);
      dataRefreshNotificationService.emitDebtsPerAssetDataRefreshEvent(debtsPerAsset);
    },

    async getFullLoanStatus({state, commit}) {
      const loanAssets = mergeArrays([
        (await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const fullLoanStatusResponse = await (await wrapContract(state.smartLoanContract, loanAssets)).getFullLoanStatus();
      const fullLoanStatus = {
        totalValue: fromWei(fullLoanStatusResponse[0]),
        debt: fromWei(fullLoanStatusResponse[1]),
        thresholdWeightedValue: fromWei(fullLoanStatusResponse[2]),
        health: fromWei(fullLoanStatusResponse[3]),
      };
      commit('setFullLoanStatus', fullLoanStatus);
    },

    async getAccountApr({state, getters, rootState, commit}){
      let apr = 0;
      let yearlyDebtInterest = 0;

      if (rootState.poolStore.pools && state.debtsPerAsset) {
        Object.entries(state.debtsPerAsset).forEach(
            ([symbol, debt]) => {
              yearlyDebtInterest += parseFloat(debt.debt) * rootState.poolStore.pools[symbol].borrowingAPY * state.assets[symbol].price;
            }
        );

        let yearlyLpInterest = 0;

        if (state.lpAssets && state.lpBalances) {
          for (let entry of Object.entries(state.lpAssets)) {
            let symbol = entry[0]
            let lpAsset = entry[1]

            //TODO: take from API
            let assetAppretiation = symbol === 'sAVAX' ? 1.072 : 1;
            yearlyLpInterest += parseFloat(state.lpBalances[symbol]) * (((1 + await lpAsset.apr()) * assetAppretiation) - 1) * lpAsset.price;
          }
        }

        let yearlyFarmInterest = 0;

        if (rootState.stakeStore.farms) {
          for (let entry of Object.entries(rootState.stakeStore.farms)) {
            let symbol = entry[0];
            let farms = entry[1];

            for (let farm of farms) {
              let assetAppretiation = symbol === 'sAVAX' ? 1.072 : 1;
              let apy = 0;

              try {
                apy = await farm.apy();
              } catch(e) {
                console.log('apy')
              }

              yearlyFarmInterest += parseFloat(farm.totalStaked) * (((1 + apy) * assetAppretiation) - 1) * farm.price;

            }
          }
        }

        const collateral = getters.getCollateral;

        if (collateral) {
          apr = (yearlyLpInterest + yearlyFarmInterest - yearlyDebtInterest) / collateral;
        }

        commit('setAccountApr', apr);
      }
    },

    async swapToWavax({state, rootState}) {
      const provider = rootState.network.provider;
      await state.wavaxTokenContract.connect(provider.getSigner()).deposit({value: toWei('1000')});
    },

    async fund({state, rootState, commit, dispatch}, {fundRequest}) {
      const provider = rootState.network.provider;
      const amountInWei = parseUnits(fundRequest.value.toString(), fundRequest.assetDecimals);
      const fundToken = new ethers.Contract(tokenAddresses[fundRequest.asset], erc20ABI, provider.getSigner());

      const allowance = formatUnits(await fundToken.allowance(rootState.network.account, state.smartLoanContract.address), fundRequest.assetDecimals);

      if (parseFloat(allowance) < parseFloat(fundRequest.value)) {
        const approveTransaction = await fundToken.connect(provider.getSigner()).approve(state.smartLoanContract.address, amountInWei);
        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [fundRequest.asset]
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).fund(
          toBytes32(fundRequest.asset),
          amountInWei,
          {gasLimit: 500000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();
      console.log(4)

      await awaitConfirmation(transaction, provider, 'fund');
      setTimeout(async () => {
        await dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 30000);
    },

    async fundNativeToken({state, rootState, commit, dispatch}, {value}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [config.nativeToken]
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).depositNativeToken({
        value: toWei(String(value)),
        gasLimit: 500000
      });

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();
      await awaitConfirmation(transaction, provider, 'fund');

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 30000);
    },

    async withdraw({state, rootState, commit, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).withdraw(
          toBytes32(withdrawRequest.asset),
        parseUnits(String(withdrawRequest.value), withdrawRequest.assetDecimals),
          {gasLimit: 3000000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(transaction, provider, 'withdraw');

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 30000);
    },

    async withdrawNativeToken({state, rootState, commit, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).unwrapAndWithdraw(toWei(String(withdrawRequest.value)));

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(transaction, provider, 'withdraw');
      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 30000);
    },

    async provideLiquidity({state, rootState, commit, dispatch}, {provideLiquidityRequest}) {
      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.secondAsset].decimals;

      let minAmount = 0.9;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
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
        parseUnits((minAmount * parseFloat(provideLiquidityRequest.secondAmount)).toFixed(secondDecimals), BigNumber.from(secondDecimals.toString())),
        {gasLimit: 4000000}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(transaction, provider, 'create LP token');

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 30000);
    },

    async removeLiquidity({state, rootState, commit, dispatch}, {removeLiquidityRequest}) {

      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.secondAsset].decimals;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.firstAsset, removeLiquidityRequest.secondAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract[config.DEX_CONFIG[removeLiquidityRequest.dex].removeLiquidityMethod](
        toBytes32(removeLiquidityRequest.firstAsset),
        toBytes32(removeLiquidityRequest.secondAsset),
        parseUnits(removePaddedTrailingZeros(removeLiquidityRequest.value), BigNumber.from(removeLiquidityRequest.assetDecimals.toString())),
        parseUnits((removeLiquidityRequest.minFirstAmount), BigNumber.from(firstDecimals.toString())),
        parseUnits((removeLiquidityRequest.minSecondAmount), BigNumber.from(secondDecimals.toString())),
        {gasLimit: 4000000}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(transaction, provider, 'unwind LP token');

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 30000);
    },

    async borrow({state, rootState, commit, dispatch}, {borrowRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [borrowRequest.asset]
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).borrow(
          toBytes32(borrowRequest.asset),
          parseUnits(String(borrowRequest.amount), config.ASSETS_CONFIG[borrowRequest.asset].decimals),
          {gasLimit: 3000000});

      rootState.serviceRegistry.progressBarService.requestProgressBar(35000);
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(transaction, provider, 'borrow');
      setTimeout(async () => {
        await dispatch('poolStore/setupPools', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 35000);
    },

    async repay({state, rootState, commit, dispatch}, {repayRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).repay(
          toBytes32(repayRequest.asset),
          parseUnits(parseFloat(repayRequest.amount).toFixed(repayRequest.decimals), BigNumber.from(repayRequest.decimals)),
          {gasLimit: 3000000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(transaction, provider, 'repay');
      setTimeout(async () => {
        await dispatch('poolStore/setupPools', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 30000);
    },

    async swap({state, rootState, commit, dispatch}, {swapRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [swapRequest.targetAsset]
      ]);

      let sourceDecimals = config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(String(swapRequest.sourceAmount), sourceDecimals);

      let targetDecimals = config.ASSETS_CONFIG[swapRequest.targetAsset].decimals;
      let targetAmount = parseUnits(swapRequest.targetAmount.toFixed(targetDecimals), targetDecimals);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).yakSwap(
        sourceAmount,
        targetAmount,
        swapRequest.path,
        swapRequest.adapters,
        {gasLimit: 4000000}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(transaction, provider, 'swap');

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 30000);
    },

    async wrapNativeToken({state, rootState, commit, dispatch}, {wrapRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).wrapNativeToken(
        parseUnits(parseFloat(wrapRequest.amount).toFixed(wrapRequest.decimals)),
        {gasLimit: 3000000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(transaction, provider, 'wrap');

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 30000);
    },
  }
};
