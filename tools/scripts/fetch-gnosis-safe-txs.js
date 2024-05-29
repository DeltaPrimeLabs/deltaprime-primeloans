const NETWORK_SLUG = "arbitrum";
const SAFE_ADDRESS = "0x764a9756994f4E6cd9358a6FcD924d566fC2e666";
// const SAFE_ADDRESS = "0x18C244c62372dF1b933CD455769f9B4DdB820F0C";
const NATIVE_TOKEN_SLUG = "ETH";
const TOKEN_ADDRESSES = require('./token_addresses_for_scripts_arbitrum.json');
const TOKEN_DECIMALS = require('./token_decimals_for_scripts.json');

const fetch = require("node-fetch");
const fs = require("fs");
const {formatUnits} = require("./fetch-parse-event-for-accounts");


function arrayToCSV(data) {
    const csvRows = [];

    for (const row of data) {
        csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
}

const fetchMultisigTransactions = async () => {
    let transactions = [];
    let i = 0;
    let resp;

    while (i == 0 || resp.next) {
        let url =
            i == 0
            ?
            `https://safe-transaction-${NETWORK_SLUG}.safe.global/api/v1/safes/${SAFE_ADDRESS}/multisig-transactions/?limit=200`
            :
            resp.next;

        resp = await (await fetch(url)).json();
        let filteredResults = resp.results.filter(tx => tx.transactionHash && (Number(tx.value) > 0 || (tx.dataDecoded && tx.dataDecoded.method === 'transfer')));
        transactions.push(...filteredResults.map(el => {
                let isERC20 =  Number(el.value) == 0 && el.dataDecoded && el.dataDecoded.method === 'transfer';
                let tokenAddress = isERC20 ? el.to : null;
                let tokenSymbol = isERC20 ? Object.entries(TOKEN_ADDRESSES).find(([k,v]) => v.toLowerCase() === tokenAddress.toLowerCase())[0] : NATIVE_TOKEN_SLUG;
                let to = isERC20 ? el.dataDecoded.parameters[0].value : el.to;
                let amount = isERC20 ? el.dataDecoded.parameters[1].value / 10 ** TOKEN_DECIMALS[tokenSymbol] : el.value / 10 ** 18;

                return [el.executionDate, el.transactionHash, tokenSymbol, tokenAddress, to, amount]
            }
        ));
        // transactions.push(...resp.results.map(el => [el.executionDate, el.to, el.value]).filter(el => Number(el[2]) > 0));
        i++;
    }

    const csvPath = `gnosis-transactions-${NETWORK_SLUG}-${SAFE_ADDRESS}.csv`; // Path where you want to save the CSV file
    const csvData = arrayToCSV(transactions);

    fs.writeFile(csvPath, csvData, (err) => {
        if (err) throw err;
        console.log('CSV file has been saved.');
    });

}

const fetchReceivedTransfers = async () => {
    let transactions = [];
    let i = 0;
    let resp;

    while (i == 0 || resp.next) {
        if (resp){
            console.log(resp.next)
        }
        let url =
            i == 0
                ?
                `https://safe-transaction-${NETWORK_SLUG}.safe.global/api/v1/safes/${SAFE_ADDRESS}/incoming-transfers/?limit=200`
                :
                resp.next;

        resp = await (await fetch(url)).json();
        let filteredResults = resp.results.filter(el => new Date(el.executionDate).getTime() < 1708732800000)
        // let filteredResults = resp.results;

        transactions.push(...filteredResults.map(el => {
            let amount, tokenSymbol;

            if (!el.tokenInfo) return [];
            let info = Object.entries(TOKEN_ADDRESSES).find(([k,v]) => v.toLowerCase() === el.tokenInfo.address.toLowerCase());
            if (info) tokenSymbol = info[0];

            if (tokenSymbol) {
                amount = el.value / 10**el.tokenInfo.decimals;
                console.log(new Date(el.executionDate).getTime()  / 1000)
                let dollarValue = getDollarValue(tokenSymbol, amount, new Date(el.executionDate).getTime()  / 1000);
                return [el.executionDate, el.transactionHash, tokenSymbol, el.tokenInfo.address, amount, dollarValue]
            } else {
                console.log(el)
                return []
            }

        }));
        i++;
    }

    const csvPath = `gnosis-received-transfers-${NETWORK_SLUG}-${SAFE_ADDRESS}.csv`; // Path where you want to save the CSV file
    const csvData = arrayToCSV(transactions);

    fs.writeFile(csvPath, csvData, (err) => {
        if (err) throw err;
        console.log('CSV file has been saved.');
    });

}

function getDollarValue(symbol, amount, timestamp) {
    const prices = JSON.parse(fs.readFileSync('historical_prices_array.json')).list;
    prices.sort((a, b) => a[0] - b[0]);

    let feed;
    let feedTimestamp;
    let noFeedAtTimestamp = false;
    let i = 1;

    while (!feed && i < prices.length) {
        if ((parseInt(prices[i - 1][0]) > timestamp && timestamp < parseInt(prices[i][0])) ||
            noFeedAtTimestamp ||
            i === prices.length - 1
        ) {
            feed = prices[i - 1][1].find(feed => feed.dataFeedId === symbol);

            if (!feed) {
                noFeedAtTimestamp = true;
            } else {
                feedTimestamp = prices[i - 1][0];
            }
        }

        i++;
    }

    if (!feed) {
        console.log(`Missing feed for ${symbol}, timestamp: ${feedTimestamp}`)
        return 0;
    } else {
        console.log(`${feedTimestamp} feed: ${new Date(feedTimestamp * 1000)}  & ${new Date(timestamp * 1000)}`)
        console.log(`Symbol: ${symbol}, time: ${new Date(feedTimestamp * 1000)}, price: ${feed.value}`)
        return feed.value * amount;
    }
}

// fetchReceivedTransfers()
fetchMultisigTransactions()