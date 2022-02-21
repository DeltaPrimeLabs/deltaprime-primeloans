module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    let result = await deploy('PoolWithAccessNFT', {
        from: deployer,
        gasLimit: 8000000
    });

    console.log(`Deployed PoolWithAccessNFT implementation at address: ${result.address}`);

    result = await deploy('SmartLoansFactoryWithAccessNFT', {
        from: deployer,
        gasLimit: 8000000
    });

    console.log(`Deployed SmartLoansFactoryWithAccessNFT implementation at address: ${result.address}`);

    result = await deploy('SmartLoanLimitedCollateral', {
        from: deployer,
        gasLimit: 8000000
    });

    console.log(`Deployed SmartLoanLimitedCollateral implementation at address: ${result.address}`);

    result = await deploy('BorrowAccessNFT', {
        from: deployer,
        gasLimit: 8000000
    });

    console.log(`Deployed BorrowAccessNFT at address: ${result.address}`);


    result = await deploy('DepositAccessNFT', {
        from: deployer,
        gasLimit: 8000000
    });

    console.log(`Deployed DepositAccessNFT at address: ${result.address}`);

};

module.exports.tags = ['Upgrade'];
