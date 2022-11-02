import {awaitConfirmation} from '../utils/blockchain';
import SMART_LOAN from '@artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import SMART_LOAN_FACTORY_TUP from '@contracts/SmartLoansFactoryTUP.json';
import SMART_LOAN_FACTORY from '@contracts/SmartLoansFactory.json';
import TOKEN_MANANGER from '@contracts/TokenManager.json';
import {formatUnits, fromWei, parseUnits, toWei} from '@/utils/calculate';
import config from '@/config';
import {WrapperBuilder} from 'redstone-evm-connector';
import redstone from 'redstone-api';
import {BigNumber} from "ethers";
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';

const toBytes32 = require('ethers').utils.formatBytes32String;
const fromBytes32 = require('ethers').utils.parseBytes32String;

const ethers = require('ethers');

const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdcTokenAddress = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';

const tokenAddresses = TOKEN_ADDRESSES;

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
    avaxDebt: null,
    usdcDebt: null,
    ltv: null,
    fullLoanStatus: {},
    noSmartLoan: null,
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

    setAvaxDebt(state, avaxDebt) {
      state.avaxDebt = avaxDebt;
    },

    setUsdcDebt(state, debt) {
      state.usdcDebt = debt;
    },

    setLTV(state, ltv) {
      state.ltv = ltv;
    },

    setFullLoanStatus(state, status) {
      state.fullLoanStatus = status;
    },

    setNoSmartLoan(state, noSmartLoan) {
      state.noSmartLoan = noSmartLoan;
    },
  },
  actions: {
    async fundsStoreSetup({state, dispatch, commit}) {
      await dispatch('setupContracts');
      await dispatch('setupSupportedAssets');
      await dispatch('setupAssets');
      await dispatch('setupLpAssets');
      state.assetBalances = [];
      if (state.smartLoanContract.address !== NULL_ADDRESS) {
        state.assetBalances = null;
        await dispatch('getAllAssetsBalances');
        await dispatch('getDebts');
        await dispatch('getLTV');
        await dispatch('getFullLoanStatus');
      } else {
        commit('setNoSmartLoan', true);
      }
    },

    async updateFunds({dispatch}) {
      await dispatch('setupAssets');
      await dispatch('setupLpAssets');
      await dispatch('getAllAssetsBalances');
      await dispatch('getDebts');
      await dispatch('getLTV');
      await dispatch('getFullLoanStatus');
    },


    async setupSupportedAssets({commit}) {
      const tokenManager = new ethers.Contract(TOKEN_MANANGER.address, TOKEN_MANANGER.abi, provider.getSigner());
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

    async setupContracts({rootState, commit, dispatch}) {
      const provider = rootState.network.provider;

      const smartLoanFactoryContract = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner());
      const wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider.getSigner());
      const usdcTokenContract = new ethers.Contract(usdcTokenAddress, erc20ABI, provider.getSigner());

      commit('setSmartLoanFactoryContract', smartLoanFactoryContract);
      commit('setWavaxTokenContract', wavaxTokenContract);
      commit('setUsdcTokenContract', usdcTokenContract);

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

    async createAndFundLoan({state, rootState, commit, dispatch}, {asset, value}) {
      const provider = rootState.network.provider;

      //TODO: make it more robust
      if (asset === 'AVAX') {
        asset = config.ASSETS_CONFIG['AVAX']
        await state.wavaxTokenContract.deposit({ value: toWei(String(value)) });
      }

      if (asset === 'WAVAX') {
        asset = config.ASSETS_CONFIG['AVAX']
      }

      const amount = parseUnits(String(value), config.ASSETS_CONFIG[asset.symbol].decimals);
      const fundToken = new ethers.Contract(tokenAddresses[asset.symbol], erc20ABI, provider.getSigner());

      await fundToken.approve(state.smartLoanFactoryContract.address, amount);
      const wrappedSmartLoanFactoryContract = WrapperBuilder.wrap(wrappedSmartLoanFactoryContract).usingDataService(
          {
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 10,
            dataFeeds: ["AVAX", "ETH", "USDC", "BTC", "LINK"],
          },
          ["https://d33trozg86ya9x.cloudfront.net"]
      );

      const transaction = await wrappedSmartLoanFactoryContract.createAndFundLoan(toBytes32(asset.symbol), fundToken.address, amount, {gasLimit: 50000000});

      await awaitConfirmation(transaction, provider, 'createAndFundLoan');
      await dispatch('setupSmartLoanContract');
      // TODO check on mainnet
      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 5000);
    },

    async getAllAssetsBalances({state, commit}) {
      const balances = {};
      const lpBalances = {};
      const assetBalances = await state.smartLoanContract.getAllAssetsBalances();
      assetBalances.forEach(
          el => {
            let symbol = fromBytes32(el.name);
            if (config.ASSETS_CONFIG[symbol]) {
              balances[symbol] = formatUnits(el.balance.toString(), config.ASSETS_CONFIG[symbol].decimals);
            }
            if (config.LP_ASSETS_CONFIG[symbol]) {
              lpBalances[symbol] = formatUnits(el.balance.toString(), config.LP_ASSETS_CONFIG[symbol].decimals);
            }
          }
      );

      await commit('setAssetBalances', balances);
      await commit('setLpBalances', lpBalances);
    },

    async getDebts({state, commit}) {
      const debts = await state.smartLoanContract.getDebts();
      debts.forEach(debt => {
        const debtAsset = fromBytes32(debt.name);
        if (debtAsset === 'AVAX') {
          commit('setAvaxDebt', formatUnits(debt.debt, config.ASSETS_CONFIG[debtAsset].decimals));
        } else if (debtAsset === 'USDC') {
          commit('setUsdcDebt', formatUnits(debt.debt, config.ASSETS_CONFIG[debtAsset].decimals));
        }
      });
    },

    async getLTV({state, rootState, commit}) {
      const ltvResponse = await state.smartLoanContract.getLTV();
      const ltv = parseInt(ltvResponse) / 1000;
      commit('setLTV', ltv);
    },

    async getFullLoanStatus({state, commit}) {
      const fullLoanStatusResponse = await state.smartLoanContract.getFullLoanStatus();
      const fullLoanStatus = {
        totalValue: fromWei(fullLoanStatusResponse[0]),
        debt: fromWei(fullLoanStatusResponse[1]),
      }
      commit('setFullLoanStatus', fullLoanStatus);
    },

    async swapToWavax({state, rootState}) {
      const provider = rootState.network.provider;
      await state.wavaxTokenContract.connect(provider.getSigner()).deposit({value: toWei('1000')});
    },

    async fund({state, rootState, commit, dispatch}, {fundRequest}) {
      const provider = rootState.network.provider;

      const fundToken = new ethers.Contract(tokenAddresses[fundRequest.asset], erc20ABI, provider.getSigner());

      await fundToken.connect(provider.getSigner()).approve(state.smartLoanContract.address, parseUnits(fundRequest.value, fundRequest.assetDecimals));

      const transaction = await state.smartLoanContract.fund(toBytes32(fundRequest.asset), parseUnits(fundRequest.value, fundRequest.assetDecimals), {gasLimit: 50000000});

      await awaitConfirmation(transaction, provider, 'fund');
      await dispatch('getAllAssetsBalances');
      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 1000);
    },

    async fundNativeToken({state, rootState, commit, dispatch}, {value}) {
      const provider = rootState.network.provider;

      const transaction = await state.smartLoanContract.depositNativeToken({value: toWei(String(value)), gasLimit: 50000000});

      await awaitConfirmation(transaction, provider, 'fund');
      await dispatch('getAllAssetsBalances');
      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 1000);
    },

    async withdraw({state, rootState, commit, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;
      const transaction = await state.smartLoanContract.withdraw(toBytes32(withdrawRequest.asset),
        parseUnits(String(withdrawRequest.value), withdrawRequest.assetDecimals), {gasLimit: 50000000});
      await awaitConfirmation(transaction, provider, 'withdraw');
      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 1000);
    },

    async withdrawNativeToken({state, rootState, commit, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;
      const transaction = await state.smartLoanContract.unwrapAndWithdraw(toWei(String(withdrawRequest.value)));

      await awaitConfirmation(transaction, provider, 'withdraw');
      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 1000);
    },

    async provideLiquidity({state, rootState, commit, dispatch}, {lpRequest}) {
      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[lpRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[lpRequest.secondAsset].decimals;

      let minAmount = .9;

      const transaction = await state.smartLoanContract[config.DEX_CONFIG[lpRequest.dex].addLiquidityMethod](
        toBytes32(lpRequest.firstAsset),
        toBytes32(lpRequest.secondAsset),
        parseUnits(lpRequest.firstAmount.toFixed(firstDecimals), BigNumber.from(firstDecimals.toString())),
        parseUnits(lpRequest.secondAmount.toFixed(secondDecimals), BigNumber.from(secondDecimals.toString())),
        parseUnits((minAmount * lpRequest.firstAmount).toFixed(firstDecimals), BigNumber.from(firstDecimals.toString())),
        parseUnits((minAmount * lpRequest.secondAmount).toFixed(secondDecimals), BigNumber.from(secondDecimals.toString())),
        {gasLimit: 50000000}
      );

      await awaitConfirmation(transaction, provider, 'provide liquidity');

      await dispatch('getAllAssetsBalances');
      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 1000);
    },

    async borrow({state, rootState, commit, dispatch}, {borrowRequest}) {
      const provider = rootState.network.provider;

      const transaction = await state.smartLoanContract.borrow(toBytes32(borrowRequest.asset),
        parseUnits(String(borrowRequest.amount), config.ASSETS_CONFIG[borrowRequest.asset].decimals), {gasLimit: 50000000});

      await awaitConfirmation(transaction, provider, 'borrow');
      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 1000);
    },

    async repay({state, rootState, commit, dispatch}, {repayRequest}) {
      const provider = rootState.network.provider;

      const transaction = await state.smartLoanContract.repay(toBytes32(repayRequest.asset), toWei(String(repayRequest.amount)), {gasLimit: 50000000});

      await awaitConfirmation(transaction, provider, 'repay');
      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 1000);
    },

    async swap({state, rootState, commit, dispatch}, {swapRequest}) {
      const provider = rootState.network.provider;
      const transaction = await state.smartLoanContract.swapPangolin(
        toBytes32(swapRequest.sourceAsset),
        toBytes32(swapRequest.targetAsset),
        parseUnits(String(swapRequest.sourceAmount), config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals),
        parseUnits(String(0), config.ASSETS_CONFIG[swapRequest.targetAsset].decimals),
        {gasLimit: 50000000}
      );

      await awaitConfirmation(transaction, provider, 'swap');
      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 1000);
    },


  }
};
