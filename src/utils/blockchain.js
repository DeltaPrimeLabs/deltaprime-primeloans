import Vue from "vue";
import config from "@/config";
import ApolloClient, {gql} from "apollo-boost";
import {fromWei} from "./calculate";

export function transactionUrl(tx) {
    return 'https://snowtrace.io/tx/' + tx;
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

export async function fetchEventsForSmartLoan(address) {
    let query = `
    {
      smartLoanEvents(where: { smartLoan: "${address.toString()}"}, orderBy: timestamp) {
        id
        name
        toAsset
        amount
        timestamp
      }
    }
   `;

    const client = new ApolloClient({
        uri: config.subgraph
    })

    return (await client.query({query: gql(query)})).data.smartLoanEvents;
}

export async function fetchCollateralFromPayments(address) {
    let query = `
    {   
        smartLoan(id: "${address}") {
            collateralFromPayments
        }
    }
   `;

    const client = new ApolloClient({
        uri: config.subgraph
    })

    return fromWei((await client.query({query: gql(query)})).data.smartLoan.collateralFromPayments);
}

export async function fetchEventsForPool(address) {
    let query = `
    {
      poolEvents(where: { user: "${address.toString()}"}, orderBy: timestamp) {
        id
        name
        amount
        timestamp
      }
    }
   `;

    const client = new ApolloClient({
        uri: config.subgraph
    })

    return (await client.query({query: gql(query)})).data.poolEvents;
}

export async function fetchDepositFromPayments(address) {
    let query = `
    {   
        poolUser(id: "${address}") {
            depositFromPayments
        }
    }
   `;

    const client = new ApolloClient({
        uri: config.subgraph
    })

    let user = (await client.query({query: gql(query)})).data.poolUser;
    if (user) {
        return fromWei((await client.query({query: gql(query)})).data.poolUser.depositFromPayments);
    } else return 0;
}