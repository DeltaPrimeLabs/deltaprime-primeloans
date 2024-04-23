const tokenManagerAddress = "0xF3978209B7cfF2b90100C6F87CEC77dE928Ed58e";
const smartLoansFactoryAddress = "0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D";
const poolAddress = "0xD26E504fc642B96751fD55D3E68AF295806542f5";
const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";

const ethers = require("ethers");

const OwnableAbi = [
    'function owner() external view returns (address)',
    'function admin() external returns (address)',
]

async function getInfo(contractAddress) {
    const provider = new ethers.providers.JsonRpcProvider(jsonRPC);
    const contract = new ethers.Contract(contractAddress, OwnableAbi, provider);
    const owner = await contract.owner();

    const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
    const adminValue = await provider.getStorageAt(contractAddress, ethers.BigNumber.from(adminSlot));
    const [admin] = ethers.utils.defaultAbiCoder.decode(["address"], adminValue);

    return { admin, owner };
}

async function main() {
    let { admin: tokenManagerAdmin, owner: tokenManagerOwner } = await getInfo(tokenManagerAddress);
    console.log("TokenManager admin:", tokenManagerAdmin);
    console.log("TokenManager owner:", tokenManagerOwner);

    let { admin: smartLoansFactoryAdmin, owner: smartLoansFactoryOwner } = await getInfo(smartLoansFactoryAddress);
    console.log("SmartLoansFactory admin:", smartLoansFactoryAdmin);
    console.log("SmartLoansFactory owner:", smartLoansFactoryOwner);

    let { admin: poolAdmin, owner: poolOwner } = await getInfo(poolAddress);
    console.log("Pool admin:", poolAdmin);
    console.log("Pool owner:", poolOwner);
}

main();
