export function transactionUrl(tx) {
    return 'https://explorer.avax-test.network/tx/' + tx;
}

export function parseArweaveURI(uri) {
    return "https://arweave.net/" + uri.replace("ar://", "");
}