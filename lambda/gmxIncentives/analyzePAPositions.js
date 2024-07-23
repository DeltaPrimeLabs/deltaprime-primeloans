const ethers = require('ethers');

const {
    fromWei,
    fromBytes32,
    toBytes32,
    formatUnits,
    arbitrumHistoricalProvider,
} = require('../utils/helpers');

const TOKEN_ADDRESSES_ARBI = {
    "ETH": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    "USDC": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "USDC.e": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    "ARB": "0x912CE59144191C1204E64559FE8253a0e49E6548",
    "USDT": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "GMX": "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
    "BTC": "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    "DAI": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    "MAGIC": "0x539bdE0d7Dbd336b79148AA742883198BBF60342",
    "JOE": "0x371c7ec6D8039ff7933a2AA28EB827Ffe1F52f07",
    "WOO": "0xcafcd85d8ca7ad1e1c6f82f651fa15e33aefd07b",
    "GRAIL": "0x3d9907f9a368ad0a51be60f7da3b97cf940982d8",
    "LINK": "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
    "UNI": "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0",
    "FRAX": "0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F",
    "GLP": "0x5402B5F40310bDED796c7D0F3FF6683f5C0cFfdf",
    "SOL": "0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07",
    "GM_ETH_WETH_USDC": "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
    "GM_ARB_ARB_USDC": "0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407",
    "GM_LINK_LINK_USDC": "0x7f1fa204bb700853D36994DA19F830b6Ad18455C",
    "GM_UNI_UNI_USDC": "0xc7Abb2C5f3BF3CEB389dF0Eecd6120D451170B50",
    "GM_SOL_SOL_USDC": "0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9",
    "GM_BTC_WBTC_USDC": "0x47c031236e19d024b42f8AE6780E44A573170703",
    "LVL": "0xB64E280e9D1B5DbEc4AcceDb2257A87b400DB149",
    "arbSnrLLP": "0x5573405636F4b895E511C9C54aAfbefa0E7Ee458",
    "arbMzeLLP": "0xb076f79f8D1477165E2ff8fa99930381FB7d94c1",
    "arbJnrLLP": "0x502697AF336F7413Bb4706262e7C506Edab4f3B9",
    "PENDLE_EZ_ETH_LP": "0xecCDC2C2191d5148905229c5226375124934b63b",
    "PENDLE_EZ_ETH_26_09_24": "0xB3f215aFD47Dd29f4B82D9b480BB86FeAF543e67",
    "PENDLE_WSTETH_LP": "0xdb0e1D1872202A81Eb0cb655137f4a937873E02f",
    "PENDLE_WSTETH_26_06_25": "0x4d2Faa48Ef93Cc3c8A7Ec27F3Cb91cEB1a36F89B",
    "PENDLE_E_ETH_LP": "0x264f4138161aaE16b76dEc7D4eEb756f25Fa67Cd",
    "PENDLE_E_ETH_26_09_24": "0xa7D760926F3098E9fb5A93018155578fCDad75C0",
    "PENDLE_RS_ETH_LP": "0xe3B327c43b5002eb7280Eef52823698b6cDA06cF",
    "PENDLE_RS_ETH_26_09_24": "0x9e411b97437Af296D6c4b482893c63Ffd8DfBE6D",
    "PENDLE_SILO_ETH_WSTETH_LP": "0xCcCC7c80c9Be9fDf22e322A5fdbfD2ef6ac5D574",
    "ezETH": "0x2416092f143378750bb29b79eD961ab195CcEea5",
    "wstETH": "0x5979D7b546E38E414F7E9822514be443A4800529",
    "weETH": "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
    "rsETH": "0x4186BFC76E2E237523CBC30FD220FE055156b41F",
    "YY_WOMBEX_USDT": "0x8Bc6968b7A9Eed1DD0A259eFa85dc2325B923dd2",
    "YY_WOMBEX_USDC.e": "0x4649c7c3316B27C4A3DB5f3B47f87C687776Eb8C",
    "YY_WOMBEX_GLP": "0x28f37fa106AA2159c91C769f7AE415952D28b6ac",
    "YY_WOMBEX_DAI": "0x1817fE376740b53CAe73224B7F0a57F23DD4C9b5",
    "MOO_GMX": "0x5B904f19fb9ccf493b623e5c8cE91603665788b0"
}

const getAllOwnedAssetsAbi = [
    {
        "inputs": [],
        "name": "getAllOwnedAssets",
        "outputs": [
            {
                "internalType": "bytes32[]",
                "name": "result",
                "type": "bytes32[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
]
const getAllAssetsBalancesAbi = [
    {
        "inputs": [],
        "name": "getAllAssetsBalances",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "bytes32",
                        "name": "name",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "uint256",
                        "name": "balance",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct SmartLoanViewFacet.AssetNameBalance[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
]

const commonAbi = [...getAllOwnedAssetsAbi, ...getAllAssetsBalancesAbi];
let blockBeforePausingProtocol = 235008030;

async function runMethod(contract, methodName, blockNumber) {
    const tx = await contract.populateTransaction[methodName]()
    let res = await contract.provider.call(tx, blockNumber)
    return contract.interface.decodeFunctionResult(
        methodName,
        res
    );
}

function getAssetDecimals(assetAddress) {
    let assetAddressLowercase = assetAddress.toLowerCase();
    return {
        '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 18,   // ETH
        '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 6,    // USDC
        '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': 6,    // USDC.e
        '0x912ce59144191c1204e64559fe8253a0e49e6548': 18,   // ARB
        '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 6,    // USDT
        '0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a': 18,   // GMX
        '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': 8,    // BTC
        '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1': 18,   // DAI
        '0xf97f4df75117a78c1a5a0dbb814af92458539fb4': 18,   // LINK
        '0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0': 18,   // UNI
        '0x17fc002b466eec40dae837fc4be5c67993ddbd6f': 18,   // FRAX
        '0x5402b5f40310bded796c7d0f3ff6683f5c0cffdf': 18,   // GLP
        '0x5979d7b546e38e414f7e9822514be443a4800529': 18,   // wstETH
        '0xb64e280e9d1b5dbec4accedb2257a87b400db149': 18,   // LVL
        '0x371c7ec6d8039ff7933a2aa28eb827ffe1f52f07': 18,   // JOE
        '0xcafcd85d8ca7ad1e1c6f82f651fa15e33aefd07b': 18,   // WOO
        '0x3d9907f9a368ad0a51be60f7da3b97cf940982d8': 18,   // GRAIL
        '0x502697af336f7413bb4706262e7c506edab4f3b9': 18,   // arbJnrLLP
        '0x5573405636f4b895e511c9c54aafbefa0e7ee458': 18,   // arbSnrLLP
        '0xb076f79f8d1477165e2ff8fa99930381fb7d94c1': 18, // arbMzeLLP
        '0x539bde0d7dbd336b79148aa742883198bbf60342': 18, // MAGIC
        '0x70d95587d40a2caf56bd97485ab3eec10bee6336': 18, // GM_ETH_WETH_USDC
        '0xc25cef6061cf5de5eb761b50e4743c1f5d7e5407': 18, // GM_ARB_ARB_USDC
        '0x7f1fa204bb700853d36994da19f830b6ad18455c': 18, // GM_LINK_LINK_USDC
        '0xc7abb2c5f3bf3ceb389df0eecd6120d451170b50': 18, // GM_UNI_UNI_USDC
        '0x09400d9db990d5ed3f35d7be61dfaeb900af03c9': 18, // GM_SOL_SOL_USDC
        '0x47c031236e19d024b42f8ae6780e44a573170703': 18, // GM_BTC_WBTC_USDC.e
        '0x8bc6968b7a9eed1dd0a259efa85dc2325b923dd2': 18, // YY_WOMBEX_USDT
        '0x4649c7c3316b27c4a3db5f3b47f87c687776eb8c': 18, // YY_WOMBEX_USDC.e
        '0x28f37fa106aa2159c91c769f7ae415952d28b6ac': 18, // YY_WOMBEX_GLP
        '0x1817fe376740b53cae73224b7f0a57f23dd4c9b5': 18, // YY_WOMBEX_DAI
        '0xeccdc2c2191d5148905229c5226375124934b63b': 18, // PENDLE_EZ_ETH_LP
        '0xb3f215afd47dd29f4b82d9b480bb86feaf543e67': 18, // PENDLE_EZ_ETH_26_09_24
        '0xdb0e1d1872202a81eb0cb655137f4a937873e02f': 18, // PENDLE_WSTETH_LP
        '0x4d2faa48ef93cc3c8a7ec27f3cb91ceb1a36f89b': 18, // PENDLE_WSTETH_26_06_25
        '0x264f4138161aae16b76dec7d4eeb756f25fa67cd': 18, // PENDLE_E_ETH_LP
        '0xa7d760926f3098e9fb5a93018155578fcdad75c0': 18, // PENDLE_E_ETH_26_09_24
        '0xe3b327c43b5002eb7280eef52823698b6cda06cf': 18, // PENDLE_RS_ETH_LP
        '0x9e411b97437af296d6c4b482893c63ffd8dfbe6d': 18, // PENDLE_RS_ETH_26_09_24
        '0xcccc7c80c9be9fdf22e322a5fdbfd2ef6ac5d574': 18, // PENDLE_SILO_ETH_WSTETH_LP
        '0x2416092f143378750bb29b79ed961ab195cceea5': 18, // ezETH
        '0x35751007a407ca6feffe80b3cb397736d2cf4dbe': 18, // weETH
        '0x4186BFC76E2E237523CBC30FD220FE055156b41F': 18, // rsETH
        '0x4186bfc76e2e237523cbc30fd220fe055156b41f': 18 // MOO_GMX
    }[assetAddressLowercase]
}

function getPricesWithLatestTimestamp(prices, symbol) {
    if (symbol in prices) {
        let symbolPriceObject = prices[symbol];
        let currentNewestTimestampIndex = 0;
        for (let i = 0; i < symbolPriceObject.length; i++) {
            if (symbolPriceObject[i].timestampMilliseconds > symbolPriceObject[currentNewestTimestampIndex].timestampMilliseconds) {
                currentNewestTimestampIndex = i;
            }
        }
        return symbolPriceObject[currentNewestTimestampIndex].dataPoints[0].value;
    } else {
        throw new Error(`Symbol ${symbol} not found in the prices object`);
    }
}
const getRedstonePrices = async function (tokenSymbols) {
    const rs_cache_url = REDSTONE_CACHE_LAYER_URLS[process.env.rs_cache_layer_index ?? 0];
    const dataServiceId = process.env.dataServiceId ?? "redstone-arbitrum-prod";
    const url = `${rs_cache_url}/data-packages/latest/${dataServiceId}`

    const redstonePrices = await (await fetch(url)).json();

    let result = [];
    for (const symbol of tokenSymbols) {
        result.push(getPricesWithLatestTimestamp(redstonePrices, symbol));
    }
    return result;
}

async function checkPAPositions(paAddress){
    const paContract = new ethers.Contract(paAddress, commonAbi, arbitrumHistoricalProvider);
    let ownedAssetsBalances = await runMethod(paContract, 'getAllAssetsBalances', blockBeforePausingProtocol);
    let ownedAssetsBalancesAndValues = {}
    console.log(ownedAssetsBalances)
    let prices = await getRedstonePrices(ownedAssetsBalances.map(assetBalance => fromBytes32(assetBalance.name)));
    console.log(`Prices: ${prices}`)
    for(const assetBalance of ownedAssetsBalances){
        let asset = fromBytes32(assetBalance.name);
        let balance = formatUnits(assetBalance.balance.toString(), getAssetDecimals(TOKEN_ADDRESSES_ARBI[asset]));
        // let price = prices
    }

    console.log(ownedAssets);
}

checkPAPositions('0xDB246e0fc9029fFBFE93F60399Edcf3cf279901c')

