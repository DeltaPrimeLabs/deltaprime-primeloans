const tokenManagerAddress = "0xF3978209B7cfF2b90100C6F87CEC77dE928Ed58e";
const smartLoansFactoryAddress = "0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D";
const diamondAddress = '0x2916B3bf7C35bd21e63D01C93C62FB0d4994e56D';
const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";

const ethers = require("ethers");

const OwnableAbi = [
    'function owner() external view returns (address)',
    'function admin() external returns (address)',
]

const poolMapping = {
    "WavaxPoolTUP": "0xD26E504fc642B96751fD55D3E68AF295806542f5",
    "UsdcPoolTUP": "0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b",
    "btcPoolTUP": "0x475589b0Ed87591A893Df42EC6076d2499bB63d0",
    "ethPoolTUP": "0xD7fEB276ba254cD9b34804A986CE9a8C3E359148",
    "usdtPoolTUP": "0xd222e10D7Fe6B7f9608F14A8B5Cf703c74eFBcA1",
    "DepositIndex AVAX": "0xaB764b1E960E346a7f5c8CC92D5750D0F0782aD2",
    "DepositIndex USDC": "0x58Da820738d3bC3583566ECFc5660B176AC446A6",
    "DepositIndex BTC": "0x637FdB03d95b36Bb25B6b44964b4725482546A08",
    "DepositIndex ETH": "0x796Dbe7Adc72158f08B0b79E20cAA4293d32132f",
    "DepositIndex USDT": "0x5F6847cAc849d67AcfE2da9CCaff3DF11F9e1E9F",
    "BorrowIndex WAVAX": "0x7201e8cB96fF5bDfa69377f2F29a21027FF7dBB1",
    "BorrowIndex USDC": "0x93a0F1d983aE56ab19fE72961842e9e576830E80",
    "BorrowIndex BTC": "0x8F0848B329Ad310ABadD7f85C3c0cFEcEB0a78FD",
    "BorrowIndex ETH": "0x66b8Ad391b2d37E60B5B9ec7F96686E9Efedb2Cb",
    "BorrowIndex USDT": "0x646aFd5FFF39962672bBbfAC80106F0f9d8ff9fe",
    "PrimeBridge":	"0x35643752F4ea0ba70456F0CA1e2778f783206a20",
    "PositionManager":	"0x13652F4a37235293a90a1dE5B878c9435EAf4c58",
    "sPrimeUP":	"0xd38C5cEca20Fb43503E108ed8d4CaCA5B57E730E",
    "vPrimeUP":	"0x228a19fC13932C67D538fEba858359E369e5a197",
    "vPrimeControllerUP":	"0x881fa171A7b5bf5c84d213043037ab867ce4688c",
    "PrimeVesting 1":	"0x9289D0B4A3723b6F69b03e79fE9BfC79982764b8",
    "PrimeVesting 2":	"0xE2C255Ed407fda4BDe67Fd9cBEe72654F6A09e3b",
    "PangolinIntermediaryTUP":	"0xdB5D94B8Ed491B058F3e74D029775A14477cF7fA",
    "TraderJoeIntermediaryTUP":	"0x4eEcb72b47a32786e08581D6226e95d9AE3bB1Af",
    "AVAX Rates calculator": "0x4162f744F2478fE0f9b87e02191B166766542bb0",
    "USDC Rates calculator": "0x8FfA4cA6327944ed4Da2cE3ca77c416121612E32",
    "BTC Rates calculator": "0x994F4216769C4d9CC6A3dd80A9141Ba45Df4DAdF",
    "ETH Rates calculator": "0xb354BC1329c523744c3E9C31140aa52F2953C89f",
    "USDT Rates calculator": "0xDC39CC885BD5d766CA7f5a9Ab2814b74F33ab493",
};

const knownAddresses = {
    "0x44AfCcF712E8A097a6727B48b57c75d7A85a9B0c": "MULTISIG OWNER",
    "0x6855A3cA53cB01646A9a3e6d1BC30696499C0b4a": "MUTLISIG ADMIN",
    "0x3cF61b8628Ec980f26bE5AcC6B1052bE9F49f1d4": "TIMELOCK OWNER",
    "0x57AA5E3af98BddF2B1fF3115f2F0F3c2052F7F12": "TIMELOCK ADMIN",
    "0x5C31bF6E2E9565B854E7222742A9a8e3f78ff358": "Timelock24h",
    "0x2fEA1f3F0c21F757B89918a884cdEEF1B74AB9a5": "Timelock10MIN",
    "0x8f430e5d18CCa67288c74c72bb3326F62cc1f7B7": "LEDGER Kamil1",
    "0x073b893284303708C515f4d246eE2f81e58d0ac4": "LEDGER Kamil3",
};

function getReadableName(address) {
    return knownAddresses[address] || "Unknown";
}

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
    let data = [];

    let { admin: diamondAdmin, owner: diamondOwner } = await getInfo(diamondAddress);
    data.push({ Contract: "Diamond", Admin: `${diamondAdmin} (${getReadableName(diamondAdmin)})`, Owner: `${diamondOwner} (${getReadableName(diamondOwner)})` });

    let { admin: tokenManagerAdmin, owner: tokenManagerOwner } = await getInfo(tokenManagerAddress);
    data.push({ Contract: "TokenManager", Admin: `${tokenManagerAdmin} (${getReadableName(tokenManagerAdmin)})`, Owner: `${tokenManagerOwner} (${getReadableName(tokenManagerOwner)})` });

    let { admin: smartLoansFactoryAdmin, owner: smartLoansFactoryOwner } = await getInfo(smartLoansFactoryAddress);
    data.push({ Contract: "SmartLoansFactory", Admin: `${smartLoansFactoryAdmin} (${getReadableName(smartLoansFactoryAdmin)})`, Owner: `${smartLoansFactoryOwner} (${getReadableName(smartLoansFactoryOwner)})` });

    for (let pool in poolMapping) {
        let poolAddress = poolMapping[pool];
        let { admin: poolAdmin, owner: poolOwner } = await getInfo(poolAddress);
        data.push({ Contract: pool, Admin: `${poolAdmin} (${getReadableName(poolAdmin)})`, Owner: `${poolOwner} (${getReadableName(poolOwner)})` });
    }

    console.table(data);
}
main();
