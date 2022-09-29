import {awaitConfirmation, handleCall} from '../utils/blockchain';
import SMART_LOAN from '@artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import SMART_LOAN_FACTORY_TUP from '@contracts/SmartLoansFactoryTUP.json';
import SMART_LOAN_FACTORY from '@contracts/SmartLoansFactory.json';
import PANGOLIN_EXCHANGETUP from '@contracts/PangolinIntermediaryTUP.json';
import PANGOLIN_EXCHANGE from '@artifacts/contracts/integrations/avalanche/PangolinIntermediary.sol/PangolinIntermediary.json';
import {formatUnits, fromWei, parseUnits, round, toWei} from '@/utils/calculate';
import config from '@/config';
import {acceptableSlippage, maxAvaxToBeSold, minAvaxToBeBought, parseLogs} from '../utils/calculate';
import {WrapperBuilder} from 'redstone-evm-connector';
import {fetchCollateralFromPayments, fetchEventsForSmartLoan} from '../utils/graph';
import redstone from 'redstone-api';


const toBytes32 = require('ethers').utils.formatBytes32String;
const fromBytes32 = require('ethers').utils.parseBytes32String;

const ethereum = window.ethereum;

const ethers = require('ethers');

const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdcTokenAddress = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';

const tokenAddresses = {
  'AVAX': '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  'USDC': '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
  'ETH': '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',
  'BTC': '0x50b7545627a5162f82a992c33b87adc75187b218',
  'USDT': '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
  'PNG': '0x60781C2586D68229fde47564546784ab3fACA982',
  'SAVAX': '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE',
  'XAVA': '0xd1c3f94de7e5b45fa4edbba472491a9f4b166fc4',
  'LINK': '0x5947bb275c521040051d82396192181b413227a3',
  'YAK': '0x59414b3089ce2af0010e7523dea7e2b35d776ec7',
  'QI': '0x8729438eb15e2c8b576fcc6aecda6a148776c0f5',
  'JOE': '0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd',
  'YYAV3SA1': '0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95',
  '$YYVSAVAXV2': '0xd0F41b1C9338eB9d374c83cC76b684ba3BB71557'
}

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
    supportedAssets: null,
    provider: null,
    smartLoanContract: null,
    smartLoanFactoryContract: null,
    wavaxTokenContract: null,
    usdcTokenContract: null,
    assetBalances: null,
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
      await dispatch('getAllAssetsBalances');
      await dispatch('getDebts');
      await dispatch('getLTV');
      await dispatch('getFullLoanStatus');
    },


    async setupSupportedAssets({rootState, commit}) {
      const pangolinContract = new ethers.Contract(PANGOLIN_EXCHANGETUP.address, PANGOLIN_EXCHANGE.abi, provider.getSigner());
      const whiteListedTokenAddresses = await pangolinContract.getAllWhitelistedTokens();
      // const supported = [];

      const supported = whiteListedTokenAddresses.map(address => Object.keys(tokenAddresses).find(symbol => tokenAddresses[symbol].toLowerCase() === address.toLowerCase()));

      commit('setSupportedAssets', supported);
    },

    async setupAssets({state, commit, dispatch}) {

      const nativeToken = Object.entries(config.ASSETS_CONFIG).find(asset => asset[0] === config.nativeToken);

      let assets = {};
      assets[nativeToken[0]] = nativeToken[1];
      state.supportedAssets.forEach(
        asset => assets[asset] = config.ASSETS_CONFIG[asset]
      );


      await redstone.getPrice(Object.keys(assets)).then(prices => {
        Object.keys(assets).forEach(assetSymbol => {
          assets[assetSymbol].price = prices[assetSymbol].value;
        });
      });
      commit('setAssets', assets);
    },

    async setupContracts({state, rootState, commit, dispatch}) {
      const provider = rootState.network.provider;

      const smartLoanFactoryContract = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner());
      const wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider.getSigner());
      const usdcTokenContract = new ethers.Contract(usdcTokenAddress, erc20ABI, provider.getSigner());
      const smartLoanContract = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner());

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

    async createAndFundLoan({state, rootState, commit, dispatch}, {value}) {
      const provider = rootState.network.provider;
      await state.wavaxTokenContract.connect(provider.getSigner()).approve(state.smartLoanFactoryContract.address, toWei(String(value)));
      const wrappedSmartLoanFactoryContract = WrapperBuilder.wrapLite(state.smartLoanFactoryContract).usingPriceFeed(config.dataProviderId);

      const transaction = await wrappedSmartLoanFactoryContract.createAndFundLoan(toBytes32('AVAX'), state.wavaxTokenContract.address, toWei(String(value)), {gasLimit: 50000000});

      await awaitConfirmation(transaction, provider, 'createAndFundLoan');
      await dispatch('setupSmartLoanContract');
      // TODO check on mainnet
      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 5000);
    },

    async getAllAssetsBalances({state, rootState, commit}) {
      const balances = await state.smartLoanContract.getAllAssetsBalances();
      await commit('setAssetBalances', balances);
    },

    async getDebts({state, rootState, commit}) {
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

      const fundTokenAddress = new ethers.Contract(tokenAddresses[fundRequest.asset], erc20ABI, provider.getSigner());

      await fundTokenAddress.connect(provider.getSigner()).approve(state.smartLoanContract.address, parseUnits(fundRequest.value, fundRequest.assetDecimals));
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
        parseUnits(String(withdrawRequest.value), config.ASSETS_CONFIG[withdrawRequest.asset].decimals), {gasLimit: 50000000});

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

      await state.wavaxTokenContract.connect(provider.getSigner()).approve(SMART_LOAN_FACTORY_TUP.address, toWei(String(repayRequest.amount)));
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
