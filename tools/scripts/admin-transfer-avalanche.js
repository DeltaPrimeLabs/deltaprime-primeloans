const jsonRPC = "<RPC_URL>";
const ethers = require("ethers");
const transferAdminAbi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newAdmin",
                "type": "address"
            }
        ],
        "name": "changeAdmin",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

async function transferAdmin() {
    let currentContractChangesData = require('./owners-admin-changes-avalanche.json');
    for(const row of currentContractChangesData) {
        let [chain, contractAddress, contractName, currentController, newController, roleName] = row;

        try {
            if(roleName !== "admin"){
                console.log(`Role name (${roleName}) for contract ${contractAddress} != admin, skipping...`);
                continue;
            }

            if(currentController !== "0x40E4Ff9e018462Ce71Fa34aBdFA27B8C5e2B1AfB"){
                console.log(`Current controller (${currentController}) for contract ${contractAddress} != 0x40E4Ff9e018462Ce71Fa34aBdFA27B8C5e2B1AfB, skipping...`);
                continue;
            }

            if(newController !== "0x6855A3cA53cB01646A9a3e6d1BC30696499C0b4a"){
                console.log(`INVALID new controller (${newController}) for contract ${contractAddress}, skipping...`);
                continue;
            }

            console.log(`Transferring admin of ${contractName} from ${currentController} to ${newController}`);
            const provider = new ethers.providers.JsonRpcProvider(jsonRPC);
            const wallet = new ethers.Wallet("<PRIVATE_KEY>").connect(provider);
            const contract = new ethers.Contract(contractAddress, transferAdminAbi, wallet);
            const tx = await contract.changeAdmin(newController);
            await tx.wait();
            console.log(`Admin of ${contractName} (${contractAddress}) transferred to ${newController} in tx: ${tx.hash}`);
        } catch (error) {
            console.log(`Error transferring admin of ${contractName} from ${currentController} to ${newController}: ${JSON.stringify(error)}`);
        }
    }
}

transferAdmin()