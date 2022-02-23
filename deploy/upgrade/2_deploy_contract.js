module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const contractName = 'CONTRACT_NAME';
    let result = await deploy(contractName, {
        from: deployer,
        gasLimit: 8000000
    });

    console.log(`Deployed ${contractName} implementation at address: ${result.address}`);
};

module.exports.tags = ['deploy-contract'];
