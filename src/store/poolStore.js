import {awaitConfirmation, handleCall} from '../utils/blockchain';
import SMART_LOAN from '@contracts/SmartLoanLogicFacet.json';
import SMART_LOAN_FACTORY_TUP from '@contracts/SmartLoansFactoryTUP.json';
import SMART_LOAN_FACTORY from '@contracts/SmartLoansFactory.json';
import PANGOLIN_EXCHANGETUP from '@contracts/PangolinExchangeTUP.json';
import PANGOLIN_EXCHANGE from '@artifacts/contracts/PangolinExchange.sol/PangolinExchange.json';
import EXCHANGE from '@artifacts/contracts/PangolinExchange.sol/PangolinExchange.json';
import POOL from '@artifacts/contracts/WavaxPool.sol/WavaxPool.json';
import POOL_TUP from '@contracts/WavaxPoolTUP.json';
import {formatUnits, fromWei, parseUnits, round, toWei} from '@/utils/calculate';
import config from '@/config';
import {acceptableSlippage, maxAvaxToBeSold, minAvaxToBeBought, parseLogs} from '../utils/calculate';
import {WrapperBuilder} from 'redstone-evm-connector';
import {fetchCollateralFromPayments, fetchEventsForSmartLoan} from '../utils/graph';
import redstone from 'redstone-api';
import {BigNumber} from 'ethers';


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
  state: {},
  getters: {},
  mutations: {},
  actions: {

    async setup({dispatch}) {

    },

    async deposit({state, rootState, commit, dispatch}) {
      const provider = rootState.network.provider;

      const exchangeContract = new ethers.Contract('0x04C89607413713Ec9775E14b954286519d836FEf', EXCHANGE.abi, provider.getSigner());
      const usdcTokenContract = new ethers.Contract('0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664', erc20ABI, provider.getSigner());
      const wavaxTokenContract = rootState.fundsStore.wavaxTokenContract;
      const poolContract = new ethers.Contract(POOL_TUP.address, POOL.abi, provider.getSigner());

      await wavaxTokenContract.connect(provider.getSigner()).approve(poolContract.address, toWei('20'));
      await poolContract.connect(provider.getSigner()).deposit(toWei('20'));

      // await wavaxTokenContract.connect(provider.getSigner()).transfer('0x04C89607413713Ec9775E14b954286519d836FEf', toWei('2'));
      // await exchangeContract.connect(provider.getSigner()).swap(toBytes32('AVAX'), toBytes32('USDC'), toWei('2'), 0);

      // await usdcTokenContract.connect(provider.getSigner()).approve(poolContract.address, parseUnits('20', BigNumber.from('6')));
      // await poolContract.connect(provider.getSigner()).deposit(parseUnits('20', BigNumber.from('6')));
    }
  },
}
