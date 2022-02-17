const web3Abi  = require('web3-eth-abi');
const {ethers} = require("hardhat");

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

    let result = await deploy('SmartLoansFactory', {
        from: deployer,
        gasLimit: 8000000,
        args: []
    });

    console.log(`SmartLoansFactory implementation deployed at address: ${result.address} by a factory`);


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

    const smartLoanImplementation = await ethers.getContract("SmartLoan");

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

    console.log(`SmartLoansFactoryTUP deployed at address: ${resultTup.address}`);

};