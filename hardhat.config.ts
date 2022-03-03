import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import "hardhat-watcher";
import "@nomiclabs/hardhat-etherscan";
require('hardhat-deploy');

const fs = require('fs');
const deployerKey = fs.readFileSync(".secret-deployer").toString().trim();
const adminKey = fs.readFileSync(".secret-admin").toString().trim();

export default {
  solidity: "0.8.4",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337,
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      timeout: 1800000,
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      },
      accounts: {
        accountsBalance: "1000000000000000000000000" // 1000.000 ETH
      },
      // mining: {
      //   auto: false,
      //   interval: 1000
      // }
    },
    localhost: {
      timeout: 1800000,
      url: 'http://127.0.0.1:8545/',
      chainId: 1337,
      // accounts: [deployerKey, adminKey]
    },
    fuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      gasPrice: 225000000000,
      chainId: 43113,
      accounts: [deployerKey, adminKey]
    },
    mainnet: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      gasPrice: 100000000000,
      chainId: 43114,
      accounts: [deployerKey, adminKey]
    }
  },
  paths: {
    tests: "./test"
  },
  watcher: {
    compilation: {
      tasks: ["compile"],
      files: ["./contracts"],
      verbose: true,
    },
    ci: {
      tasks: [
        "clean",
        {command: "compile", params: {quiet: true}},
        {command: "test", params: {noCompile: true}}
      ],
    },
    test: {
      tasks: [{command: 'test', params: {noCompile: true, testFiles: ['{path}']}}],
      files: ['./test/*.ts'],
      verbose: true
    }
  },
  mocha: {
    "allow-uncaught": true
  },
  namedAccounts: {
      deployer: 0,
      admin: 1
  },
  etherscan: {
    apiKey: {
      avalancheFujiTestnet: "8ZZX5UV18YJKIK4FNQCF3M699VU5D6AGC4",
    }
  },
  deploy: {
    skipIfAlreadyDeployed: true
  }
};
