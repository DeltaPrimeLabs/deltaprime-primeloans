const {ethers} = require("hardhat");
module.exports = async ({
  getNamedAccounts,
  deployments
}) => {
  const {deploy} = deployments;
  const {deployer, admin} = await getNamedAccounts();

  await deploy('PoolFactory', {
    from: deployer,
    gasLimit: 8000000,
    args: [],
  });


  const factory = await ethers.getContract("PoolFactory");

  const tx = await factory.deployPool();
  const receipt = await tx.wait();
  let poolAddress = receipt.events[0].args[0];

  console.log(`Pool deployed at address: ${poolAddress} by a factory`);

  let result = await deploy('PoolTUP', {
    from: deployer,
    gasLimit: 8000000,
    args: [poolAddress, admin, []],
  });

  console.log(`PoolTUP deployed at address: ${result.address}`);

};

module.exports.tags = ['Main'];
