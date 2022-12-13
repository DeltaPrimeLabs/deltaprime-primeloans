import Vue from 'vue';
import {WrapperBuilder} from '@redstone-finance/evm-connector';
import CACHE_LAYER_URLS from '../../common/redstone-cache-layer-urls.json';

export const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function totalSupply() public view returns (uint256 supply)',
  'function totalDeposits() public view returns (uint256 deposits)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)'
];

export function transactionUrl(tx) {
  return 'https://snowtrace.io/tx/' + tx;
}

export const wrapContract = async function wrapContract(contract, assets) {
  //for more symbols in data feed it's more optimal to not specify asset list
  let providedAssets = (assets && assets.length <= 5) ? assets : undefined;

  return WrapperBuilder.wrap(contract).usingDataService(
    {
      dataServiceId: 'redstone-avalanche-prod',
      uniqueSignersCount: 3,
      dataFeeds: providedAssets,
      disablePayloadsDryRun: true
    },
    CACHE_LAYER_URLS.urls
  );
};

export async function handleTransaction(fun, args, onSuccess, onFail) {
  try {
    const tx = Array.isArray(args) ? await fun(...args) : await fun(args);
    if (tx) {
      await provider.waitForTransaction(tx.hash);
    }

    if (onSuccess) {
      console.log('BLOCKCHAIN.js onSuccess');
      onSuccess();
    }

  } catch (error) {
    if (onFail) {
      console.log('BLOCKCHAIN.js onFail');
      onFail(error);
    }
  }
}

export async function awaitConfirmation(tx, provider, actionName) {
  const transaction = await provider.waitForTransaction(tx.hash);

  if (transaction.status === 0) {
    console.log(transaction);
    Vue.$toast.error(`Failed to ${actionName}. Check Metamask for more info.`);
  } else Vue.$toast.success(`${capitalizeFirstLetter(actionName)} transaction success!`);

  // await provider.waitForTransaction(tx.hash, 4);
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}


export async function handleCall(fun, args, onSuccess, onFail) {
  try {
    if (!args) {
      return await fun();
    } else {
      return Array.isArray(args) ? await fun(...args) : await fun(args);
    }

    if (onSuccess) {
      onSuccess();
    }
  } catch (error) {
    console.log(error);
    let message = error.data ? error.data.message : (error.message ? error.message : error);

    if (message.startsWith('[ethjs-query]')) {
      if (message.includes('reason string')) {
        message = message.split('reason string ')[1].split('","data":')[0];
      } else {
        message = message.split('"message":"')[1].replace('."}}}\'', '');
      }
    }

    message = message.replace('Error: VM Exception while processing transaction: reverted with reason string ', '');
    message = message.replace('execution reverted: ', '');
    message = message.replace(/'/g, '');

    Vue.$toast.error(message);
    if (onFail) onFail();
  }
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function isPausedError(e) {
  if (e && e.data && e.data.message) {
    return e.data.message.includes('ProtocolUpgrade: paused');
  }
}

export function isOracleError(e) {
  const ORACLE_ERROR = '0x2b13aef500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003';
  return e.data && e.data.data && e.data.data.includes(ORACLE_ERROR);
}