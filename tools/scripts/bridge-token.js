const fs = require("fs");
const ethers = require("ethers");

const {getUrlForNetwork} = require("./helpers");
const PrimeBridgeArtifact = require("../../artifacts/contracts/token/PrimeBridge.sol/PrimeBridge.json");

const toWei = ethers.utils.parseUnits;
const IERC20ApproveAbi = [
    {
        "constant": false,
        "inputs": [
            {
                "name": "_spender",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "name": "",
                "type": "bool"
            }
        ],
        "type": "function"
    }
];

function initWallet(networkName) {
    const key = fs.readFileSync(`./.secrets/${networkName}/admin`).toString().trim();
    console.log(getUrlForNetwork(networkName));
    const provider = new ethers.providers.JsonRpcProvider(getUrlForNetwork(networkName));

    return new ethers.Wallet(key, provider);
}

async function bridgeTokens(networkName) {
    const wallet = initWallet(networkName);

    const recipientAddress = '0x15066d6c882e63b33e12179DE4FceCdfCa93De1d'
    const primeTokenAddress = '0x33C8036E99082B0C395374832FECF70c42C7F298'
    const avalancheChainId = 106;
    const arbitrumChainId = 110;
    const bridgeContractAddress = '0x35643752F4ea0ba70456F0CA1e2778f783206a20'

    let defaultAdapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])

    const receiverBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [recipientAddress])
    const amountToSend =  toWei("10");
    const destinationChain = arbitrumChainId;  // In case of Avalanche it should be 110
    const bridgeContract = new ethers.Contract(bridgeContractAddress, PrimeBridgeArtifact.abi, wallet);
    const primeTokenContract = new ethers.Contract(primeTokenAddress, IERC20ApproveAbi, wallet);
    await primeTokenContract.approve(bridgeContract.address, amountToSend);
    console.log('Approved')
    await new Promise(resolve => setTimeout(resolve, 10000));

    let nativeFee = (await bridgeContract.estimateSendFee(destinationChain, receiverBytes32, amountToSend, false, defaultAdapterParams)).nativeFee;

    console.log(`Briding ${amountToSend} from Avalanche to Arbitrum to ${naokiAddress} with fee ${nativeFee}`);
    await bridgeContract
        .sendFrom(
            wallet.address,
            destinationChain,
            receiverBytes32,
            amountToSend,
            [wallet.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee}
        );
}

bridgeTokens("avalanche");