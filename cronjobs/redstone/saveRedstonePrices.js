const fs = require('fs');
const { requestDataPackages } = require("redstone-sdk");

const saveRedstonePrices = async () => {
  const chains = ['avalanche', 'arbitrum'];

  await Promise.all(
    chains.map(async (chain) => {
      const dataPackages = await requestDataPackages({
        dataServiceId: `redstone-${chain}-prod`,
        uniqueSignersCount: 3,
      });
    
      fs.writeFileSync(`../redstone/${chain}DataPackages.json`, JSON.stringify(dataPackages));
    })
  )
}

saveRedstonePrices();