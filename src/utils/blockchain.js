import Vue from 'vue';
import {WrapperBuilder} from '@redstone-finance/evm-connector';
import CACHE_LAYER_URLS from '../../common/redstone-cache-layer-urls.json';
import {utils} from "ethers";
import config from '../config';

const ethers = require('ethers');

export function transactionUrl(tx) {
  return 'https://snowtrace.io/tx/' + tx;
}

export const wrapContract = async function wrapContract(contract, assets) {
  //for more symbols in data feed it's more optimal to not specify asset list
  const providedAssets = (assets && assets.length <= 5) ? assets : undefined;

  return WrapperBuilder.wrap(contract).usingDataService(
    {
      dataServiceId: config.dataProviderId,
      uniqueSignersCount: 3,
      dataFeeds: providedAssets,
      disablePayloadsDryRun: true
    },
    CACHE_LAYER_URLS.urls
  );
};

export const switchChain = async (chainId, signer) => {
  const currentChainId = await signer.getChainId();

  if (currentChainId !== chainId) {
    const ethereum = window.ethereum;
    if (typeof ethereum === 'undefined') return;

    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + chainId.toString(16) }],
    });
  }
}

export async function handleTransaction(fun, args, onSuccess, onFail) {
  try {
    const res = Array.isArray(args) ? await fun(...args) : await fun(args);

    if (onSuccess) {
      console.log('BLOCKCHAIN.js onSuccess');
      onSuccess(res);
    }

  } catch (error) {
    console.log(error);
    if (onFail) {
      console.log('BLOCKCHAIN.js onFail');
      onFail(error);
    }
  }
}

export async function glpApy() {
  return (await (await fetch('https://api.multifarm.fi/jay_flamingo_random_6ix_vegas/get_asset_details/AVAX_Gmx_GLP')).json()).feeAPRHistory[0].value;
}

export async function awaitConfirmation(tx, provider, actionName) {
  const transaction = await provider.waitForTransaction(tx.hash);

  if (transaction.status === 0) {
    console.log(transaction);
    throw `Failed to ${actionName}`;
  }
  return transaction;
}

export function getLog(tx, abi, name = '') {
  const iface = new utils.Interface(abi);
  let chosenLog;

  tx.logs.forEach(log => {
      try{
        let parsed = iface.parseLog(log);

        if (parsed.name === name) {
          chosenLog = parsed;
        }
      } catch (e) {
      }
    }
  );

  return chosenLog;
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

export async function signMessage(provider, message, wallet, depositor = false) {
  const signer = provider.getSigner();
  let signedMessage = await signer.signMessage(message);

  let signingWallet = ethers.utils.verifyMessage(message, signedMessage);

  await fetch(`https://vercel-api.deltaprime.io/api/terms?wallet=${wallet}&version=${depositor ? 'depositor' : 'loan'}&signedMessage=${signedMessage}`, {
    method: 'GET',
    mode: 'no-cors'
  });

  if (signingWallet !== wallet) {
    Vue.$toast.error(`Wrong signing wallet. Please do not change your Metamask wallet during the procedure.`);
    return false;
  }
  return true;
}

export async function signMessageForNotifi(provider, message, wallet, depositor = false) {
  const signer = provider.getSigner();
  let signedMessage = await signer.signMessage(message);

  let signingWallet = ethers.utils.verifyMessage(message, signedMessage);

  if (signingWallet !== wallet) {
    Vue.$toast.error(`Wrong signing wallet. Please do not change your Metamask wallet during the procedure.`);
    return false;
  }
  return {signedMessage: utils.arrayify(signedMessage), account: wallet};
}

export const loanTermsToSign =
  `
By entering DeltaPrime I agree to be bound by the DeltaPrime "TERMS OF USE" and herby further represent and warrant that:
I am not a citizen of, natural and legal person, having habitual residence, location or their seat of incorporation in the country or territory where transactions with digital
tokens or virtual assets are prohibited [full text available at https://arweave.net/Py7QApLEFqocjTg_rRWUsgjSdq6MT3AJf8lwmunkio4.
`;

export const depositTermsToSign =
  `
By entering DeltaPrime I agree to be bound by the DeltaPrime "TERMS OF USE" and herby further represent and warrant that:
I am not a citizen of, natural and legal person, having habitual residence, location or their seat of incorporation
in the country or territory where transactions with digital tokens or virtual assets are prohibited [full text available
at https://arweave.net/9dc5BuzFYefZrL7ciUnxyeRUFh52U3UKju7AD6InsJ8
`;