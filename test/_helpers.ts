import {ethers, network, waffle} from "hardhat";
import {BigNumber} from "ethers";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {PangolinExchange} from "../typechain";
const {provider} = waffle;

const {deployContract} = waffle;
import PangolinExchangeArtifact from '../artifacts/contracts/PangolinExchange.sol/PangolinExchange.json';
import {execSync} from "child_process";

export const toWei = ethers.utils.parseUnits;
export const formatUnits = (val: BigNumber, decimalPlaces: BigNumber) => parseFloat(ethers.utils.formatUnits(val, decimalPlaces));
export const fromWei = (val: BigNumber) => parseFloat(ethers.utils.formatEther(val));
export const fromWeiS = (val: BigNumber) => ethers.utils.formatEther(val);
export const toBytes32 = ethers.utils.formatBytes32String;
export const fromBytes32 = ethers.utils.parseBytes32String;

export type Second = number;

export const time = {
  increase: async (duration: Second) => {
    await network.provider.send("evm_increaseTime", [duration]);
    await network.provider.send("evm_mine");
  },
  duration: {
    years: (years: number): Second => {
      return 60 * 60 * 24 * 365 * years; //TODO: leap years..
    },
    months: (months: number): Second => {
      return 60 * 60 * 24 * 30 * months; // ofc. it is simplified..
    },
    days: (days: number): Second => {
      return 60 * 60 * 24 * days;
    },
    hours: (hours: number): Second => {
      return 60 * 60 * hours;
    },
    minutes: (minutes: number): Second => {
      return 60 * minutes;
    }
  }
}

export const getSelloutRepayAmount = async function (
  totalValue: number,
  debt: number,
  bonus: number,
  targetLTV: number) {

  targetLTV = targetLTV / 1000;
  bonus = bonus / 1000;
  return (targetLTV * (totalValue - debt) - debt) / (targetLTV * bonus - 1) * 1.04;
};

export const getFixedGasSigners = async function (gasLimit: number) {
  const signers: SignerWithAddress[] = await ethers.getSigners();
  signers.forEach(signer => {
    let orig = signer.sendTransaction;
    signer.sendTransaction = function (transaction) {
      transaction.gasLimit = BigNumber.from(gasLimit.toString());
      return orig.apply(signer, [transaction]);
    }
  });
  return signers;
};

export const deployAndInitPangolinExchangeContract = async function (
    owner: SignerWithAddress,
    pangolinRouterAddress: string,
    supportedAssets: Asset[]
  ) {
  const exchange = await deployContract(owner, PangolinExchangeArtifact) as PangolinExchange;
  exchange.initialize(pangolinRouterAddress, supportedAssets);
  return exchange
};

export async function syncTime() {
    const now = Math.ceil(new Date().getTime() / 1000);
    try {
        await provider.send('evm_setNextBlockTimestamp', [now]);
    } catch (error) {
        await (provider as any)._hardhatNetwork.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: "https://api.avax.network/ext/bc/C/rpc"
                    },
                },
            ],
        });

        await syncTime();
    }
}

export async function recompileSmartLoan(contractName: string, poolAddress: string, exchangeAddress: string, subpath?: string) {
    const subPath = subpath ? subpath +'/' : "";
    const artifactsDirectory = `../artifacts/contracts/${subPath}${contractName}.sol/${contractName}.json`;
    delete require.cache[require.resolve(artifactsDirectory)]
    execSync(`node -r esm -e 'require("./tools/scripts/update-smart-loan-properties.js")` +
        `.updateContracts("${poolAddress}","${exchangeAddress}")'`, { encoding: 'utf-8' });
    execSync(`npx hardhat compile`, { encoding: 'utf-8' });
    return require(artifactsDirectory);
}

export class Asset {
  asset: string;
  assetAddress: string;

  constructor(asset: string, assetAddress: string) {
    this.asset = asset;
    this.assetAddress = assetAddress;
  }
}

