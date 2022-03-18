import Vue from "vue";
import config from "@/config";

export function transactionUrl(tx) {
    return 'https://snowtrace.io/tx/' + tx;
}

//block number from which events are considered, to increase loading of events information
export function startingBlock() {
    switch (config.chainId) {
        case 43113:
            return 6490771;
        case 43114:
            return 11644638;
        default:
            return 0;
    }
}

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

    await provider.waitForTransaction(tx.hash, 3);
}

export async function handleCall(fun, args, onSuccess, onFail) {
    try {
        // await Promise.any([fetch('fdasfdsa').then(response => response.json()), fetch('fdasfdsa').then(response => response.json())])
        if (!args) {
            return await fun();
        } else {
            return Array.isArray(args) ? await fun(...args) : await fun(args);
        }

        if (onSuccess) onSuccess();
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

export async function fetchEventsInBatches(address, topics, provider, block = startingBlock()) {
    const logsPromises = [];
    let startBatch = block;
    const currentBlock = await provider.getBlockNumber();

    let endBatch = 0;

    while (endBatch < currentBlock) {
        endBatch = startBatch + 2047;

        if (endBatch > currentBlock) {
            endBatch = currentBlock;
        }

        logsPromises.push(
            provider.getLogs({
                fromBlock: startBatch,
                toBlock: endBatch,
                address: address,
                topics: [topics]
            }));

        startBatch = endBatch + 1;
    }

    return Promise.all(logsPromises);
}
