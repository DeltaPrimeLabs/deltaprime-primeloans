import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import "hardhat-watcher";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-contract-sizer";
import "hardhat-interface-generator";
// import * as tdly from "@tenderly/hardhat-tenderly";
// tdly.setup({ automaticVerifications: false });
require('hardhat-deploy');

const fs = require('fs');
function getKey(network: string, filename: string) { return fs.readFileSync(`.secrets/${network}/${filename}`).toString().trim() }

export default {
  solidity: {
    compilers: [
      {
        version: "0.4.18",
      },
      {
        version: "0.7.6",
      },
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
    ]
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: "https://api.avax.network/ext/bc/C/rpc",
      },
    },
    localhost: {
      timeout: 1800000,
      url: 'http://127.0.0.1:8545/',
      chainId: 31337,
      // accounts: [getKey('avalanche', 'deployer'), getKey('avalanche', 'admin')]
    },
    fuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      gasPrice: 225000000000,
      chainId: 43113,
      accounts: [getKey('fuji', 'deployer'), getKey('fuji', 'admin')]
    },
    avalanche: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      // url: 'https://rpc.ankr.com/avalanche',
      gasPrice: 100000000000,
      chainId: 43114,
      accounts: [getKey('avalanche', 'deployer'), getKey('avalanche', 'admin')]
    },
    mainnet_test: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      gasPrice: 100000000000,
      chainId: 43114,
      accounts: [getKey('avalanche', 'deployer'), getKey('avalanche', 'admin')]
    },
    fantom: {
      url: 'https://rpc.ftm.tools/',
      gasPrice: 250000000000,
      chainId: 250,
      accounts: [getKey('fantom', 'deployer')]
    },
    celo: {
      url: 'https://forno.celo.org',
      gasPrice: 250000000000,
      chainId: 42220,
      accounts: [getKey('celo', 'deployer')],
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
    "allow-uncaught": true,
    timeout: 5000000
  },
  namedAccounts: {
      deployer: 0,
      admin: 1
  },
  etherscan: {
    apiKey: {
      avalanche: "8ZZX5UV18YJKIK4FNQCF3M699VU5D6AGC4",
      avalancheFujiTestnet: "8ZZX5UV18YJKIK4FNQCF3M699VU5D6AGC4"
    }
  },
  deploy: {
    skipIfAlreadyDeployed: true
  }
};
