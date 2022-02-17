const Arweave = require('arweave');
const fs = require("fs");

async function uploadNFTs() {
    const path = './tools/scripts/nft/images';

    fs.truncate('./tools/scripts/nft/uris.txt', 0, function(){console.log('File truncated')})

    fs.readdir(path, function(err, filenames) {
        if (err) {
            console.log(err)
            return;
        }
        filenames.forEach(async function(filename) {
            uploadNFT(path + '/' + filename).then(
                () => console.log('Success for ' + filename),
                err => console.log('Error for ' + filename + ', error message: ' + err)
            )
        });

    });
}

async function uploadNFT(filePath){
    console.log('Loading file from path ', filePath);
    const key = JSON.parse(fs.readFileSync('./.arweave-secret.json', 'utf8'));
    const metadata = JSON.parse(fs.readFileSync('./tools/scripts/nft/metadata.json', 'utf8'));

    const file = fs.readFileSync(filePath);

    const arweave = Arweave.init({
        host: 'arweave.net',
        port: 443,
        protocol: 'https',
        timeout: 60000
    });


    //uploading an NFT file (image etc.)
    console.log('NFT image transaction');
    const transaction = await arweave.createTransaction({
        data: file
    }, key);

    await arweave.transactions.sign(transaction, key);

    let uploader = await arweave.transactions.getUploader(transaction);

    while (!uploader.isComplete) {
        await uploader.uploadChunk();
        console.log(`${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`);
    }

    await awaitTransaction(arweave, transaction.id);

    //uploading JSON metadata
    console.log('Metadata transaction');

    metadata.image = 'ar://' + transaction.id;

    const metadataTransaction = await arweave.createTransaction({
        data: JSON.stringify(metadata)
    }, key);

    await arweave.transactions.sign(metadataTransaction, key);

    await arweave.transactions.post(metadataTransaction);

    await awaitTransaction(arweave, metadataTransaction.id);

    console.log('Successfully uploaded to Arweave! NFT metadata transaction id: ', metadataTransaction.id)

    if (fs.readFileSync('./tools/scripts/nft/uris.txt').length !== 0) {
        fs.appendFileSync('./tools/scripts/nft/uris.txt', '\n');
    }

    fs.appendFile('./tools/scripts/nft/uris.txt', 'ar://' + metadataTransaction.id, function (err) {
        if (err) throw err;
        console.log('Successfully saved to uris.txt to for transaction id: ' + metadataTransaction.id);
    });
}

async function awaitTransaction(arweave, id) {
    console.log('awaitTransaction, ', id)

    let status = {};

    await sleep(async () => {
        let res = await arweave.transactions.getStatus(id)

        console.log(res)
        status = res;
        console.log('Confirmed: ', status.confirmed);

        //TODO: in production number of confirmation should be 10/20

        if (!status.confirmed || status.confirmed.number_of_confirmations < 1) {
            await awaitTransaction(arweave, id);
        } else {
            console.log('Transaction confirmed, ', id)
            return true;
        }
    });
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sleep(fn) {
    await timeout(30000);
    return fn();
}

uploadNFTs().then(() => console.log('Files uploaded!'));

