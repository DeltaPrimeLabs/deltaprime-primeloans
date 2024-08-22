const {WrapperBuilder} = require("@redstone-finance/evm-connector");
const {ethers} = require('ethers');

const rpcUrl = 'https://rpc.tenderly.co/fork/225b12ec-df2e-4ef6-a8b7-1df2ba58f782';
const provider = getProvider();

const vPrimeControllerAvalancheAddr = '0x9289D0B4A3723b6F69b03e79fE9BfC79982764b8';
const vPrimeControllerArbitrumAddr = '0xA0Ff5eA5fB3A7739791b81c83A8742044893CFaC';
let V_PRIME_CONTROLLER_ABI = require('./vPrimeControllerAbi.json');

function getProvider(){
    return new ethers.providers.JsonRpcProvider(rpcUrl);
}

async function awaitConfirmation(tx, provider, actionName, timeout) {
    const transaction = await provider.waitForTransaction(tx.hash, 1, timeout);
    if (transaction.status === 0) {
        console.log(transaction);
        console.log(`Failed to ${actionName}`);
    } else {
        console.log(`Transaction with ${transaction.transactionHash} success`);
        return transaction;
    }
}

async function updateVPrimeSnapshot(userAddress, chain){
    const liquidationPrivateKey = '0xeb1d48f010fdee4661a7773fac0fbc3c677e8c14b54644b15c130d5b743e8e9d';
    let liquidator_wallet = (new ethers.Wallet(liquidationPrivateKey)).connect(provider);

    let vPrimeControllerContract = new ethers.Contract(
        chain === 'avalanche' ? vPrimeControllerAvalancheAddr : vPrimeControllerArbitrumAddr,
        V_PRIME_CONTROLLER_ABI,
        liquidator_wallet
    );
    vPrimeControllerContract = WrapperBuilder.wrap(vPrimeControllerContract).usingDataService(
        {
            dataServiceId: "redstone-arbitrum-prod",
            uniqueSignersCount: 3,
            // @ts-ignore
            disablePayloadsDryRun: true
        }
    );

    await awaitConfirmation(
        await vPrimeControllerContract.updateVPrimeSnapshot(userAddress),
        provider,
        'updateVPrimeSnapshot',
        60_000
    )

    console.log(`Updated vPrime snapshot for ${userAddress}`);
}

let chain = 'arbitrum';
updateVPrimeSnapshot('0x0E5Bad4108a6A5a8b06820f98026a7f3A77466b2', chain);