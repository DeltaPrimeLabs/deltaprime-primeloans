import {ethers, network, waffle} from "hardhat";
import {BigNumber, Contract} from "ethers";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {MockSmartLoanLogicFacetSetValues, PangolinExchange} from "../typechain";

import {execSync} from "child_process";
import updateSmartLoanLibrary from "../tools/scripts/update-smart-loan-library"

const {provider} = waffle;
const {deployDiamond, deployFacet} = require('../tools/diamond/deploy-diamond');
const {deployContract} = waffle;

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

export const toRepay = function (
    action: string,
    debt: number,
    initialTotalValue: number,
    targetLTV: number,
    bonus: number
) {
    switch (action) {
        case 'CLOSE':
            return debt;
        case 'HEAL':
            //bankrupt loan
            return (debt - targetLTV * (initialTotalValue - debt)) / (1 + targetLTV);
        default:
            //liquidate
            return ((1 + targetLTV) * debt - targetLTV * initialTotalValue) / (1 - targetLTV * bonus);

    }
}


export const calculateBonus = function (
    action: string,
    debt: number,
    initialTotalValue: number,
    targetLTV: number,
    maxBonus: number
) {
    switch (action) {
        case 'CLOSE':
            return 0;
        case 'HEAL':
            return 0;
        default:
            let possibleBonus = (1 - ((1 + targetLTV) * debt - targetLTV * initialTotalValue) / debt) / targetLTV;
            return Math.round(Math.min(possibleBonus, maxBonus) * 1000) / 1000;
    }
}

//simple model: we iterate over pools and repay their debts based on how much is left to repay in USD
export const getRepayAmounts = function (
    debts: Array<number>,
    poolAssetsIndices: Array<number>,
    toRepayInUsd: number,
    mockPrices: Array<number>
) {
    let repayAmounts: Array<number> = [];
    let leftToRepayInUsd = toRepayInUsd;
    poolAssetsIndices.forEach(
        (index, i) => {
            let availableToRepayInUsd = debts[i] * mockPrices[index];
            let repaidToPool = Math.min(availableToRepayInUsd, leftToRepayInUsd);
            leftToRepayInUsd -= repaidToPool;
            repayAmounts[i] = repaidToPool / mockPrices[index];
        }
    );

    //repayAmounts are measured in appropriate tokens (not USD)
    return repayAmounts;
}

export const toSupply = function(
    poolAssetsIndices: Array<number>,
    balances: Array<number>,
    repayAmounts: Array<number>
) {
    //multiplied by 1.00001 to account for limited accuracy of calculations
    let toSupply: Array<number> = [];

    poolAssetsIndices.forEach(
        (index, i) => {
            toSupply[i] = 1.00001 * Math.max(repayAmounts[i] - balances[index], 0);
        }
    );
    return toSupply;
}

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


export const deployAllFaucets = async function(diamondAddress: any) {
    await deployFacet(
        "MockFundingFacetRP",
        diamondAddress,
        [
            'borrow',
            'repay',
            'fund',
            'withdraw',
        ],
        ''
    )
    await deployFacet("MockPangolinDEXFacetRP", diamondAddress, ['swapPangolin'])
    await deployFacet("MockYieldYakFacetRP", diamondAddress, ['stakeAVAXYak', 'unstakeAVAXYak'])
    await deployFacet("MockSmartLoanLiquidationFacetRP", diamondAddress, ['closeLoan', 'liquidateLoan', 'unsafeLiquidateLoan'])
    await deployFacet(
        "MockSmartLoanLogicFacetRP",
        diamondAddress,
        [
            'depositNativeToken',
            'getOwnedAssetsBalances',
            'getOwnedAssetsPrices',
            'wrapNativeToken',
        ]
    )
};


export const deployAndInitPangolinExchangeContract = async function (
    owner: SignerWithAddress,
    pangolinRouterAddress: string,
    supportedAssets: Asset[]
  ) {
  let exchangeFactory = await ethers.getContractFactory("PangolinExchange");
  const exchange = (await exchangeFactory.deploy()).connect(owner) as PangolinExchange;
  await exchange.initialize(pangolinRouterAddress, supportedAssets);
  return exchange
};

export async function calculateStakingTokensAmountBasedOnAvaxValue(yakContract: Contract, avaxAmount: BigNumber) {
    let totalSupply = await yakContract.totalSupply();
    let totalDeposits = await yakContract.totalDeposits();
    return avaxAmount.mul(totalSupply).div(totalDeposits);
}

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

export async function recompileSmartLoanLib(contractName: string, yieldYakAddress: string, pangolinRouterAddress: string, poolManagerAddress: string, solvencyFacetAddress: string, subpath?: string, maxLTV: number=5000, minSelloutLTV: number=4000) {
    const subPath = subpath ? subpath +'/' : "";
    const artifactsDirectory = `../artifacts/contracts/${subPath}${contractName}.sol/${contractName}.json`;
    delete require.cache[require.resolve(artifactsDirectory)]
    await updateSmartLoanLibrary(yieldYakAddress, pangolinRouterAddress, poolManagerAddress, solvencyFacetAddress, maxLTV, minSelloutLTV);
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

export class PoolAsset {
    asset: string;
    poolAddress: string;

    constructor(asset: string, poolAddress: string) {
        this.asset = asset;
        this.poolAddress = poolAddress;
    }
}
