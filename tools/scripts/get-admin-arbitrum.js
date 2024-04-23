const tokenManagerAddress = "0x0a0D954d4b0F0b47a5990C0abd179A90fF74E255";
const smartLoansFactoryAddress = "0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20";
const poolAddress = "0x2B8C610F3fC6F883817637d15514293565C3d08A";
const jsonRPC = "https://nd-762-566-527.p2pify.com/4514bd12de6723b94346752e90e95cf4";
// const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";

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
