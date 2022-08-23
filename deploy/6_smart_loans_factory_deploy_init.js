const web3Abi  = require('web3-eth-abi');
const {ethers} = require("hardhat");
const {embedCommitHash} = require("../tools/scripts/embed-commit-hash");
const hre = require("hardhat");
import verifyContract from "../tools/scripts/verify-contract";

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

    embedCommitHash('SmartLoansFactory');
    embedCommitHash('SmartLoansFactoryTUP', './contracts/proxies');

    let result = await deploy('SmartLoansFactory', {
        from: deployer,
        gasLimit: 8000000,
        args: []
    });

    await verifyContract(hre, {
        address: result.address
    })

    console.log(`SmartLoansFactory implementation deployed at address: ${result.address}`);


    const initializeInterface =   {
        "inputs": [
            {
                "internalType": "contract SmartLoan",
                "name": "_smartLoanImplementation",
                "type": "address"
            }
        ],
        "name": "initialize",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    };

    const smartLoanImplementation = await ethers.getContract("SmartLoanDiamondBeacon");

    const calldata = web3Abi.encodeFunctionCall(
        initializeInterface,
        [smartLoanImplementation.address]
    )

    const factory = await ethers.getContract("SmartLoansFactory");

    let resultTup = await deploy('SmartLoansFactoryTUP', {
        from: deployer,
        gasLimit: 8000000,
        args: [factory.address, admin, calldata],
    });

    await verifyContract(hre, {
        address: resultTup.address,
        contract: "contracts/proxies/SmartLoansFactoryTUP.sol:SmartLoansFactoryTUP",
        constructorArguments: [
            factory.address,
            admin,
            calldata
        ]
    })


    console.log(`SmartLoansFactoryTUP deployed at address: ${resultTup.address}`);

};

module.exports.tags = ['init'];
