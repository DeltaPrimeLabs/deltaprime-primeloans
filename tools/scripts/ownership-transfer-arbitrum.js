const jsonRPC = "<RPC_URL>";
const ethers = require("ethers");
const currentContractChangesData = require("./owners-admin-changes-arbitrum.json");
const transferOwnershipAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

async function transferOwnership() {
    let currentContractChangesData = require('./owners-admin-changes-arbitrum.json');
    for(const row of currentContractChangesData) {
        let [chain, contractAddress, contractName, currentController, newController, roleName] = row;

        try {
            if(roleName !== "owner"){
                console.log(`Role name (${roleName}) for contract ${contractAddress} != owner, skipping...`);
                continue;
            }

            if(currentController !== "0xbAc44698844f13cF0AF423b19040659b688ef036"){
                console.log(`Current controller (${currentController}) for contract ${contractAddress} != 0xbAc44698844f13cF0AF423b19040659b688ef036, skipping...`);
                continue;
            }

            if(newController !== "0xDfA6706FC583b635CD6daF0E3915901A2fBaBAaD"){
                console.log(`INVALID new controller (${newController}) for contract ${contractAddress}, skipping...`);
                continue;
            }

            console.log(`Transferring ownership of ${contractName} from ${currentController} to ${newController}`);
            const provider = new ethers.providers.JsonRpcProvider(jsonRPC);
            const wallet = new ethers.Wallet("<PRIVATE_KEY>").connect(provider);
            const contract = new ethers.Contract(contractAddress, transferOwnershipAbi, wallet);
            const tx = await contract.transferOwnership(newController);
            await tx.wait();
            console.log(`Ownership of ${contractName} (${contractAddress}) transferred to ${newController} in tx: ${tx.hash}`);
        } catch (error) {
            console.log(`Error transferring ownership of ${contractName} from ${currentController} to ${newController}: ${JSON.stringify(error)}`);
        }
    }
}

transferOwnership()