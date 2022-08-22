import {awaitConfirmation, handleCall} from "../utils/blockchain";
import LOAN from '@contracts/SmartLoanLogicFacet.json'
import LOAN_FACTORYTUP from '@contracts/SmartLoansFactoryTUP.json'
import LOAN_FACTORY from '@contracts/SmartLoansFactory.json'
import PANGOLIN_EXCHANGETUP from '@contracts/PangolinIntermediaryTUP.json'
import PANGOLIN_EXCHANGE from '@artifacts/contracts/PangolinIntermediary.sol/PangolinIntermediary.json'
import {formatUnits, fromWei, parseUnits, round, toWei} from "@/utils/calculate";
import config from "@/config";
import {acceptableSlippage, maxAvaxToBeSold, minAvaxToBeBought, parseLogs} from "../utils/calculate";
import {WrapperBuilder} from "redstone-evm-connector";
import {fetchCollateralFromPayments, fetchEventsForSmartLoan} from "../utils/graph";

const ethers = require('ethers');

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function totalSupply() public view returns (uint256 supply)',
  'function totalDeposits() public view returns (uint256 deposits)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)'
]

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
    collateralFromPayments: null,
    stakedAssets: null,
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
    },
    setStakedAssets(state, stakedAssets) {
      state.stakedAssets = stakedAssets;
    },
  },
  actions: {
    async initSupportedAssets({rootState, commit}) {
      const pangolinContract = new ethers.Contract(PANGOLIN_EXCHANGETUP.address, PANGOLIN_EXCHANGE.abi, provider.getSigner());
      // the first returned asset is a blockchain native currency, therefore used .slice(1)
      let supported = ((await pangolinContract.getAllAssets()).slice(1)).map(
        asset => ethers.utils.parseBytes32String(asset)
      );

      commit('setSupportedAssets', supported);
    },

    async fetchLoan({state, rootState, dispatch, commit}) {
      dispatch('updateAssets');
      dispatch('initSupportedAssets');

      const provider = rootState.network.provider;
      const account = rootState.network.account;

      const loanFactory = new ethers.Contract(LOAN_FACTORYTUP.address, LOAN_FACTORY.abi, provider.getSigner());

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
        dispatch('updateStakedAvaxYakBalance');
      }
      return true;
    },

    async updateAssets({state, commit, dispatch}) {
      console.log('async updateAssets({state, commit, dispatch}) {');

      // dispatch('updateLoanBalance');

      const loan = state.loan;

      const prices = await handleCall(loan.getAllAssetsPrices);
      const balances = await handleCall(loan.getAllAssetsBalances);

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
            assets[symbol].price = prices[0] / 10 ** 8;
            commit('network/setAvaxPrice', assets[symbol].price, {root: true});
          } else {
            assets[symbol].price = prices[i] / 10 ** 8;
            assets[symbol].balance = parseFloat(formatUnits(balances[i].toString(), assets[symbol].decimals));
          }
          assets[symbol].value = assets[symbol].balance * assets[symbol].price;
          assets[symbol].share = state.totalValue ? assets[symbol].value / (state.totalValue * assets['AVAX'].price) : 0;
        }
      )

      commit('setAssets', assets);
    },

    async updateLoanStats({state, commit}) {

      const loan = state.loan;
      const status = await handleCall(loan.getFullLoanStatus);

      commit('setTotalValue', fromWei(status[0]));
      commit('setDebt', fromWei(status[1]));
      commit('setLtv', status[2] / 1000);
    },

    async updateLoanBalance({state, rootState, commit}) {
      const provider = rootState.network.provider;
      const balance = parseFloat(formatUnits(await provider.getBalance(state.loan.address), config.ASSETS_CONFIG[config.nativeToken].decimals));

      commit('setLoanBalance', balance);
    },

    async updateLoanHistory({commit, state, rootState}) {
      const loan = state.loan;

      const provider = rootState.network.provider;

      const loanFactory =
        new ethers.Contract(LOAN_FACTORYTUP.address, LOAN_FACTORY.abi, provider.getSigner());

      loanFactory.iface = new ethers.utils.Interface(LOAN_FACTORY.abi);

      const logs = await fetchEventsForSmartLoan(loan.address);

      const loanEvents = parseLogs(logs);

      const collateral = await fetchCollateralFromPayments(loan.address);

      commit('setCollateralFromPayments', collateral);
      commit('setLoanEvents', loanEvents);
    },

    async createNewLoan({rootState, dispatch, commit}, {amount, collateral}) {
      const provider = rootState.network.provider;

      const loanFactory = new ethers.Contract(LOAN_FACTORYTUP.address, LOAN_FACTORY.abi, provider.getSigner());

      const wrappedLoanFactory = WrapperBuilder
        .wrapLite(loanFactory)
        .usingPriceFeed(config.dataProviderId);

      //TODO: find optimal value of gas
      const tx = await wrappedLoanFactory.createAndFundLoan(toWei(amount.toString()), {
        value: toWei(collateral.toString()),
        gasLimit: 1400000
      });

      await awaitConfirmation(tx, provider, 'create a Prime Account');

      dispatch('fetchLoan');
      dispatch('network/updateBalance', {}, {root: true})

      return tx;
    },

    async borrow({state, rootState, dispatch, commit}, {amount}) {
      const provider = rootState.network.provider;
      const loan = state.loan;

      const tx = await loan.borrow(toWei(amount.toString()), {gasLimit: 700000});

      await awaitConfirmation(tx, provider, 'borrow');

      dispatch('updateLoanStats');
      dispatch('updateLoanHistory');
      dispatch('updateAssets');
      dispatch('network/updateBalance', {}, {root: true})
    },

    async repay({state, rootState, dispatch, commit}, {amount}) {
      const provider = rootState.network.provider;
      const loan = state.loan;

      const tx = await loan.repay(toWei(amount.toString()), {gasLimit: 700000});

      await awaitConfirmation(tx, provider, 'repay');

      dispatch('updateLoanStats');
      dispatch('updateLoanHistory');
      dispatch('updateAssets');
      dispatch('network/updateBalance', {}, {root: true})
    },

    async fund({state, rootState, dispatch, commit}, {amount}) {
      const provider = rootState.network.provider;
      const loan = state.loan;

      const tx = await loan.fund({value: toWei(amount.toString()), gasLimit: 500000});

      await awaitConfirmation(tx, provider, 'fund');

      dispatch('updateLoanStats');
      dispatch('updateLoanHistory');
      dispatch('updateAssets');
      dispatch('network/updateBalance', {}, {root: true});
    },

    async withdraw({state, rootState, dispatch, commit}, {amount}) {
      const provider = rootState.network.provider;
      const loan = state.loan;

      const tx = await loan.withdraw(toWei(amount.toString()), {gasLimit: 500000});

      await awaitConfirmation(tx, provider, 'withdraw');

      dispatch('updateLoanStats');
      dispatch('updateLoanHistory');
      dispatch('updateAssets');
      dispatch('network/updateBalance', {}, {root: true});
    },

    async invest({state, rootState, dispatch, commit}, {asset, amount, avaxAmount, slippage, decimals}) {
      const provider = rootState.network.provider;
      const loan = state.loan;

      const maxAvaxAmount = round(maxAvaxToBeSold(avaxAmount, acceptableSlippage(slippage)));

      let tx = await loan.invest(
        ethers.utils.formatBytes32String(asset),
        parseUnits(amount.toString(), decimals),
        toWei(maxAvaxAmount.toString()),
        {gasLimit: 600000}
      );

      await awaitConfirmation(tx, provider, 'invest');

      dispatch('updateLoanStats');
      dispatch('updateLoanHistory');
      dispatch('updateLoanBalance');
      dispatch('updateAssets');
      dispatch('network/updateBalance', {}, {root: true})
    },

    async redeem({state, rootState, dispatch, commit}, {asset, amount, avaxAmount, slippage, decimals}) {
      const provider = rootState.network.provider;
      const loan = state.loan;

      const minAvaxAmount = round(minAvaxToBeBought(avaxAmount, acceptableSlippage(slippage)));

      let tx = await loan.redeem(
        ethers.utils.formatBytes32String(asset),
        parseUnits(amount.toString(), decimals),
        toWei(minAvaxAmount.toString()),
        {gasLimit: 600000}
      );

      await awaitConfirmation(tx, provider, 'redeem');

      dispatch('updateLoanStats');
      dispatch('updateLoanHistory');
      dispatch('updateLoanBalance');
      dispatch('updateAssets');
      dispatch('network/updateBalance', {}, {root: true})
    },

    async stakeAvaxYak({state, rootState, dispatch, commit}, {amount}) {

      const provider = rootState.network.provider;
      const loan = state.loan;

      const stakeTransaction = await loan.stakeAVAXYak(toWei(String(amount)), {gasLimit: 1100000});

      await awaitConfirmation(stakeTransaction, provider, 'stakeAvaxYak');

      dispatch('updateAssets');
      dispatch('updateStakedAvaxYakBalance');
      dispatch('network/updateBalance', {}, {root: true})

    },

    async unstakeAvaxYak({state, rootState, dispatch, commit}, {amount}) {

      const provider = rootState.network.provider;
      const loan = state.loan;

      const receiptToAvaxConversionRate = state.stakedAssets.YAK_YIELD.assets.AVAX.receiptToAvaxConversionRate;
      const receiptTokenAmount = amount / receiptToAvaxConversionRate;
      let receiptTokenAmountWei = toWei(String(receiptTokenAmount));
      if (receiptTokenAmountWei.gt(state.stakedAssets.YAK_YIELD.assets.AVAX.receiptTokenBalanceWei)) {
        receiptTokenAmountWei = state.stakedAssets.YAK_YIELD.assets.AVAX.receiptTokenBalanceWei
      }

      const unstakeTransaction = await loan.unstakeAVAXYak(receiptTokenAmountWei, {gasLimit: 1100000});
      await awaitConfirmation(unstakeTransaction, provider, 'unstake')

      dispatch('updateAssets');
      dispatch('updateStakedAvaxYakBalance');
      dispatch('network/updateBalance', {}, {root: true})
    },

    async updateStakedAvaxYakBalance({state, rootState, dispatch, commit}) {
      const loan = state.loan;
      const stakingContractAddress = await handleCall(loan.getYakAvaxStakingContract);
      const tokenContract = new ethers.Contract(stakingContractAddress, erc20ABI, provider.getSigner());
      const totalSupply = Number(await tokenContract.totalSupply());
      const totalDeposits = Number(await tokenContract.totalDeposits());
      const yrtToAvaxConversionRate = totalDeposits / totalSupply;
      const stakedYrtWei = await tokenContract.balanceOf(state.loan.address);
      const stakedYrt = Number(fromWei(stakedYrtWei));
      const stakedAvax = stakedYrt * yrtToAvaxConversionRate;
      const stakedAssets = {
        YAK_YIELD: {
          assets: {
            AVAX: {
              balance: stakedAvax,
              receiptTokenBalance: stakedYrt,
              receiptTokenBalanceWei: stakedYrtWei,
              receiptToAvaxConversionRate: yrtToAvaxConversionRate
            }
          }
        }
      }

      commit('setStakedAssets', stakedAssets);
    },
  }
}
