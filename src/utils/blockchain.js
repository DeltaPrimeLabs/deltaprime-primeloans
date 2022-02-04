import Vue from "vue";
import config from "@/config";

export function transactionUrl(tx) {
    return 'https://explorer.avax-test.network/tx/' + tx;
}

export function parseArweaveURI(uri) {
    return "https://arweave.net/" + uri.replace("ar://", "");
}

export function isAvalancheChain() {
    return [43113, 43114].includes(config.chainId);
}

export async function handleTransaction(fun, args, onSuccess, onFail) {
    try {
        const tx = Array.isArray(args) ? await fun(...args) : await fun(args);
        if (tx) {
            await provider.waitForTransaction(tx.hash);
        }

        Vue.$toast.success('Transaction success');
        if (onSuccess) onSuccess();
    } catch (error) {
        let message;
        if (isAvalancheChain()) {
            message = error.message;
        } else {
            message = error.data ? error.data.message : (error.message ? error.message : error);
        }

        if (message.startsWith("[ethjs-query]")) {
            if (message.includes("reason string")) {
                message = message.split("reason string ")[1].split("\",\"data\":")[0];
            } else {
                message = message.split("\"message\":\"")[1].replace(".\"}}}\'", "")
            }
        }

        message = message.replace("Error: VM Exception while processing transaction: reverted with reason string ", "");
        message = message.replace(/'/g, '')

        Vue.$toast.error(message);
        if (onFail) onFail();
    }
}

export async function handleCall(fun, args, onSuccess, onFail) {
    try {
        if (!args) {
            return await fun();
        } else {
            return Array.isArray(args) ? await fun(...args) : await fun(args);
        }

        if (onSuccess) onSuccess();
    } catch (error) {
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