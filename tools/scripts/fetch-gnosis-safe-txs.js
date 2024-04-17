const NETWORK_SLUG = "avalanche";
const SAFE_ADDRESS = "0x44AfCcF712E8A097a6727B48b57c75d7A85a9B0c";
const NATIVE_TOKEN_SLUG = "AVAX";
const TOKEN_ADDRESSES = require('./token_addresses_for_scripts.json');
const TOKEN_DECIMALS = require('./token_decimals_for_scripts.json');

const fetch = require("node-fetch");
const fs = require("fs");


function arrayToCSV(data) {
    const csvRows = [];

    for (const row of data) {
        csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
}

const run = async () => {
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
            `https://safe-transaction-${NETWORK_SLUG}.safe.global/api/v1/safes/${SAFE_ADDRESS}/multisig-transactions/?limit=200`
            :
            resp.next;

        resp = await (await fetch(url)).json();
        let filteredResults = resp.results.filter(tx => tx.transactionHash && (Number(tx.value) > 0 || (tx.dataDecoded && tx.dataDecoded.method === 'transfer')));
        console.log(filteredResults.map(el => el.dataDecoded ? el.dataDecoded.parameters : null))
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



run()