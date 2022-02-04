import {ethers} from "hardhat";
import UpgradeableBeaconArtifact
    from "../../artifacts/@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol/UpgradeableBeacon.json";
import fs from "fs";
import FACTORY from "../../build/contracts/SmartLoansFactory.json";
import POOL from "../../build/contracts/Pool.json";

const key = fs.readFileSync("./.secret-deployer").toString().trim();
let privateKeyWallet = new ethers.Wallet(key);

var provider;

provider = new ethers.providers.JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc");

let wallet = privateKeyWallet.connect(provider);
const NETWORK_ID = 43113;
const factory = new ethers.Contract(FACTORY.networks[NETWORK_ID].address, FACTORY.abi, wallet);
factory.iface = new ethers.utils.Interface(POOL.abi);

async function upgradeBeacon() {
    const Contract = await ethers.getContractFactory("SmartLoan");
    const contract = await Contract.deploy();


    const beaconAddress = await factory.upgradeableBeacon.call(0);
    const beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi)).connect(wallet);
    await beacon.connect(wallet).upgradeTo(contract.address, { gasLimit: 8000000});

    return "New implementation address " + contract.address;
}

upgradeBeacon().then(
    res => console.log(res),
    err => console.error(err)
)


