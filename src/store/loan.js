const ethers = require('ethers');
import LOAN from '@contracts/SmartLoan.json'
import LOAN_FACTORYTUP from '@contracts/SmartLoansFactoryTUP.json'
import LOAN_FACTORY from '@contracts/SmartLoansFactory.json'
import PANGOLIN_EXCHANGETUP from '@contracts/PangolinExchangeTUP.json'
import PANGOLIN_EXCHANGE from '@contracts/PangolinExchange.json'
import { fromWei, toWei, parseUnits, formatUnits } from "@/utils/calculate";
import config from "@/config";
import {maxAvaxToBeSold, acceptableSlippage, minAvaxToBeBought, parseLogs} from "../utils/calculate";
import { WrapperBuilder } from "redstone-evm-connector";

export default {
  namespaced: true,
  state: {
    loan: null,
    assets: null,
    isLoanAlreadyCreated: null,
    totalValue: null,
    debt: null,
    ltv: null,
    loanBalance: null,
    loanEvents: null,
    collateralFromPayments: null
  },
  getters: {
    getCurrentCollateral(state) {
      return state.totalValue - state.debt;
    },
    getProfit(state, getters) {
      if (getters.getCurrentCollateral !== null
          && getters.getCurrentCollateral !== 0
          && state.collateralFromPayments !== null) {
        return getters.getCurrentCollateral - state.collateralFromPayments;
      } else {
        return 0;
      }
    }
  },
  mutations: {
    setLoan(state, loan) {
      state.loan = loan;
    },
    setAssets(state, assets) {
      state.assets = assets;
    },
    setIsLoanAlreadyCreated(state, created) {
      state.isLoanAlreadyCreated = created;
    },
    setTotalValue(state, totalValue) {
      state.totalValue = totalValue;
    },
    setDebt(state, debt) {
      state.debt = debt;
    },
    setLtv(state, ltv) {
      state.ltv = ltv;
    },
    setSupportedAssets(state, assets) {
      state.supportedAssets = assets;
    },
    setLoanBalance(state, balance) {
      state.loanBalance = balance;
    },
    setLoanEvents(state, loanEvents) {
      state.loanEvents = loanEvents;
    },
    setCollateralFromPayments(state, collateral) {
      state.collateralFromPayments = collateral;
    }
  },
  actions: {
    async initSupportedAssets({ rootState, commit }) {
      const pangolinContract = new ethers.Contract(PANGOLIN_EXCHANGETUP.networks[rootState.network.chainId].address, PANGOLIN_EXCHANGE.abi, provider.getSigner());
      // the first returned asset is a blockchain native currency, therefore used .slice(1)
      let supported = ((await pangolinContract.getAllAssets()).slice(1)).map(
        asset => ethers.utils.parseBytes32String(asset)
      );

      commit('setSupportedAssets', supported);
    },
    async fetchLoan({ state, rootState, dispatch, commit }) {
      dispatch('initSupportedAssets');

      const provider = rootState.network.provider;
      const account = rootState.network.account;

      const loanFactory = new ethers.Contract(LOAN_FACTORYTUP.networks[rootState.network.chainId].address, LOAN_FACTORY.abi, provider.getSigner());

      const userLoan = await loanFactory.getLoanForOwner(account);

      commit('setIsLoanAlreadyCreated', userLoan !== ethers.constants.AddressZero);

      if (state.isLoanAlreadyCreated) {
        const loan = new ethers.Contract(userLoan, LOAN.abi, provider.getSigner());
        loan.iface = new ethers.utils.Interface(LOAN.abi);

        const wrappedLoan = WrapperBuilder
          .wrapLite(loan)
          .usingPriceFeed(config.dataProviderId);

        commit('setLoan', wrappedLoan);

        dispatch('updateLoanStats');
        dispatch('updateLoanBalance');
        dispatch('updateLoanHistory');
        dispatch('updateAssets');
      }
      return true;
    },
    async updateAssets({ state, commit, dispatch }) {
      dispatch('updateLoanBalance');

      const loan = state.loan;

      const prices = await loan.getAllAssetsPrices();
      const balances = await loan.getAllAssetsBalances();

      const nativeToken = Object.entries(config.ASSETS_CONFIG).find(asset => asset[0] === config.nativeToken);

      let assets = {};
      assets[nativeToken[0]] = nativeToken[1];
      state.supportedAssets.forEach(
        asset => assets[asset] = config.ASSETS_CONFIG[asset]
      );

      Object.entries(assets).forEach(
        (asset, i) => {
          const symbol = asset[0];
          if (symbol === config.nativeToken) {
            assets[symbol].balance = state.loanBalance;
            assets[symbol].price = prices[0] / 10**8;
          } else {
            assets[symbol].price = prices[i] / 10**8;
            assets[symbol].balance = parseFloat(formatUnits(balances[i].toString(), assets[symbol].decimals));
          }
          assets[symbol].value = assets[symbol].balance * assets[symbol].price;
          assets[symbol].share = assets[symbol].value / (state.totalValue * assets['AVAX'].price);
        }
      )

      commit('setAssets', assets);
    },
    async updateLoanStats({ state, commit }) {
      const loan = state.loan;
      const status = await loan.getFullLoanStatus();

      commit('setTotalValue', fromWei(status[0]));
      commit('setDebt', fromWei(status[1]));
      commit('setLtv', status[2]/1000);
    },
    async updateLoanBalance({ state, rootState, commit }) {
      const provider = rootState.network.provider;
      const balance = parseFloat(formatUnits(await provider.getBalance(state.loan.address), config.ASSETS_CONFIG[config.nativeToken].decimals));

      commit('setLoanBalance', balance);
    },
    async updateLoanHistory({ commit, state, rootState }) {
      const loan = state.loan;

      const provider = rootState.network.provider;

      const loanFactory =
          new ethers.Contract(LOAN_FACTORYTUP.networks[rootState.network.chainId].address, LOAN_FACTORY.abi, provider.getSigner());

      loanFactory.iface = new ethers.utils.Interface(LOAN_FACTORY.abi);

      let factoryLogs = await provider.getLogs({
        fromBlock: rootState.pool.deploymentBlock,
        address: loanFactory.address,
        topics: [ [
          loanFactory.iface.getEventTopic("SmartLoanCreated")
        ] ]
      });

      let logs = await provider.getLogs({
        fromBlock: rootState.pool.deploymentBlock,
        address: loan.address,
        topics: [ [
          loan.iface.getEventTopic("Funded"),
          loan.iface.getEventTopic("Withdrawn"),
          loan.iface.getEventTopic("Invested"),
          loan.iface.getEventTopic("Redeemed"),
          loan.iface.getEventTopic("Borrowed"),
          loan.iface.getEventTopic("Repaid"),
        ] ]
      });

      const [loanEvents, collateralFromPayments] = parseLogs(loan, logs);

      commit('setCollateralFromPayments', collateralFromPayments);
      commit('setLoanEvents', loanEvents);
    },
    async createNewLoan({ rootState, dispatch, commit }, { amount, collateral }) {
      const provider = rootState.network.provider;

      const loanFactory = new ethers.Contract(LOAN_FACTORYTUP.networks[rootState.network.chainId].address, LOAN_FACTORY.abi, provider.getSigner());

      const wrappedLoanFactory = WrapperBuilder
          .wrapLite(loanFactory)
          .usingPriceFeed(config.dataProviderId);

      //TODO: find optimal value of gas
      const tx = await wrappedLoanFactory.createAndFundLoan(toWei(amount.toString()), {value: toWei(collateral.toString()), gasLimit: 30000000});

      await provider.waitForTransaction(tx.hash);

      dispatch('fetchLoan');
    },
    async borrow({ state, rootState, dispatch, commit }, { amount }) {
      const provider = rootState.network.provider;
      const loan = state.loan;

      const tx = await loan.borrow(toWei(amount.toString()), {gasLimit: 3000000});
      await provider.waitForTransaction(tx.hash);

      dispatch('updateLoanStats');
      dispatch('updateLoanHistory');
      dispatch('updateAssets');
    },
    async repay({ state, rootState, dispatch, commit }, { amount }) {
      const provider = rootState.network.provider;
      const loan = state.loan;

      const tx = await loan.repay(toWei(amount.toString()), {gasLimit: 3000000});
      await provider.waitForTransaction(tx.hash);

      dispatch('updateLoanStats');
      dispatch('updateLoanHistory');
      dispatch('updateAssets');
    },
    async fund({ state, rootState, dispatch, commit }, { amount }) {
      const provider = rootState.network.provider;
      const loan = state.loan;

      const tx = await loan.fund({value: toWei(amount.toString()), gasLimit: 3000000});
      await provider.waitForTransaction(tx.hash);

      dispatch('updateLoanStats');
      dispatch('updateLoanHistory');
      dispatch('updateAssets');
    },
    async withdraw({ state, rootState, dispatch, commit }, { amount }) {
      const provider = rootState.network.provider;
      const loan = state.loan;

      const tx = await loan.withdraw(toWei(amount.toString()), {gasLimit: 3000000});
      await provider.waitForTransaction(tx.hash);

      dispatch('updateLoanStats');
      dispatch('updateLoanHistory');
      dispatch('updateAssets');
    },
    async invest({ state, rootState, dispatch, commit }, { asset, amount, avaxAmount, slippage, decimals }) {
      const provider = rootState.network.provider;
      const loan = state.loan;

      const maxAvaxAmount = maxAvaxToBeSold(avaxAmount, acceptableSlippage(slippage));

      let tx = await loan.invest(
        ethers.utils.formatBytes32String(asset),
        parseUnits(amount.toString(), decimals),
        toWei(maxAvaxAmount.toString()),
        {gasLimit: 3000000}
      );

      await provider.waitForTransaction(tx.hash);

      dispatch('updateLoanStats');
      dispatch('updateLoanBalance');
      dispatch('updateAssets');
    },
    async redeem({ state, rootState, dispatch, commit }, { asset, amount, avaxAmount, slippage, decimals }) {
      const provider = rootState.network.provider;
      const loan = state.loan;

      const minAvaxAmount = minAvaxToBeBought(avaxAmount, acceptableSlippage(slippage));

      let tx = await loan.redeem(
        ethers.utils.formatBytes32String(asset),
        parseUnits(amount.toString(), decimals),
        toWei(minAvaxAmount.toString()),
        {gasLimit: 3000000}
      );
      await provider.waitForTransaction(tx.hash);

      dispatch('updateLoanStats');
      dispatch('updateLoanBalance');
      dispatch('updateAssets');
    }
  }
}
