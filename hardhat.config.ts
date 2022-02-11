import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import "hardhat-watcher";

const fs = require('fs');
const deployerKey = fs.readFileSync(".secret-deployer").toString().trim();

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
    local: {
      timeout: 1800000,
      url: 'http://127.0.0.1:8545/',
      chainId: 1337
    },
    fuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      gasPrice: 225000000000,
      chainId: 43113,
      accounts: [deployerKey]
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
  }
};
