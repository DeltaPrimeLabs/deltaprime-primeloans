import Vue from "vue";
import {WrapperBuilder} from "@redstone-finance/evm-connector";

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
            // dataFeeds: providedAssets
        },
        ['https://d33trozg86ya9x.cloudfront.net']
    );
};

export async function handleTransaction(fun, args, onSuccess, onFail) {
    try {
        const tx = Array.isArray(args) ? await fun(...args) : await fun(args);
        if (tx) {
            await provider.waitForTransaction(tx.hash);
        }

        if (onSuccess) onSuccess();
    } catch (error) {
        if (onFail) onFail();
    }
}
export async function awaitConfirmation(tx, provider, actionName) {
    const transaction = await provider.waitForTransaction(tx.hash);

    if (transaction.status === 0) {
        Vue.$toast.error(`Failed to ${actionName}. Check Metamask for more info.`)
    } else Vue.$toast.success('Transaction success! Waiting for confirmations...');

    provider.waitForTransaction(tx.hash, 4).then(() => {})
}

export async function handleCall(fun, args, onSuccess, onFail) {
    try {
        if (!args) {
            return await fun();
        } else {
            return Array.isArray(args) ? await fun(...args) : await fun(args);
        }

        if (onSuccess) {
            onSuccess()
        }
    } catch (error) {
        console.log(error);
        let message = error.data ? error.data.message : (error.message ? error.message : error);

        if (message.startsWith("[ethjs-query]")) {
            if (message.includes("reason string")) {
                message = message.split("reason string ")[1].split("\",\"data\":")[0];
            } else {
                message = message.split("\"message\":\"")[1].replace(".\"}}}\'", "")
            }
        }

        message = message.replace("Error: VM Exception while processing transaction: reverted with reason string ", "");
        message = message.replace("execution reverted: ", "");
        message = message.replace(/'/g, '')

        Vue.$toast.error(message);
        if (onFail) onFail();
    }
}

export function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}