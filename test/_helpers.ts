import {ethers, network, waffle} from "hardhat";
import {BigNumber, Contract} from "ethers";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    CompoundingIndex,
    MockToken,
    OpenBorrowersRegistry__factory,
    Pool,
    VariableUtilisationRatesCalculator
} from "../typechain";
import AVAX_TOKEN_ADDRESSES from '../common/addresses/avax/token_addresses.json';
import CELO_TOKEN_ADDRESSES from '../common/addresses/celo/token_addresses.json';
import VariableUtilisationRatesCalculatorArtifact
    from '../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import PoolArtifact from '../artifacts/contracts/Pool.sol/Pool.json';
import CompoundingIndexArtifact from '../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';
import MockTokenArtifact from "../artifacts/contracts/mock/MockToken.sol/MockToken.json";

import {execSync} from "child_process";
import updateConstants from "../tools/scripts/update-constants"

const {provider} = waffle;
const {deployFacet} = require('../tools/diamond/deploy-diamond');
const {deployContract} = waffle;

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function transfer(address _to, uint256 _value) public returns (bool success)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)'
]

const wavaxAbi = [
    'function deposit() public payable',
    ...erc20ABI
]

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
            return debt;
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
    action: string,
    debts: any,
    toRepayInUsd: number,
    mockPrices: any
) {
    let repayAmounts: any = {};

    let leftToRepayInUsd = toRepayInUsd;

    for (const [asset, debt] of Object.entries(debts)) {
        if (action === 'HEAL' || action === 'CLOSE') {
            repayAmounts[asset] = Number(debt) * 1.00001;
        } else {
            let availableToRepayInUsd = Number(debt) * mockPrices[asset];
            let repaidToPool = Math.min(availableToRepayInUsd, leftToRepayInUsd);
            leftToRepayInUsd -= repaidToPool;
            repayAmounts[asset] = repaidToPool / mockPrices[asset];
        }
    }

    //repayAmounts are measured in appropriate tokens (not USD)
    return repayAmounts;
}

export const toSupply = function (
    balances: any,
    repayAmounts: any
) {
    //multiplied by 1.00001 to account for limited accuracy of calculations
    let toSupply: any = {};

    for (const [asset, amount] of Object.entries(repayAmounts)) {
        // TODO: Change 1.1 to smth smaller if possible
        toSupply[asset] = 1.1 * Math.max(Number(amount) - (balances[asset] ?? 0), 0);
    }

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


export const deployAllFacets = async function (diamondAddress: any, chain = 'AVAX') {
    await deployFacet(
        "OwnershipFacet",
        diamondAddress,
        [
            'transferOwnership',
        ]
    )
    await deployFacet(
        "AssetsOperationsFacet",
        diamondAddress,
        [
            'borrow',
            'repay',
            'fund',
            'withdraw',
        ],
        ''
    )
    await deployFacet("SolvencyFacet", diamondAddress, [])
    if (chain == 'AVAX') {
        await deployFacet("SmartLoanWrappedNativeTokenFacet", diamondAddress, ['depositNativeToken', 'wrapNativeToken', 'unwrapAndWithdraw'])
        await deployFacet("PangolinDEXFacet", diamondAddress, ['swapPangolin'])
        await deployFacet("VectorFinanceFacet", diamondAddress, [
            'vectorStakeUSDC1',
            'vectorUnstakeUSDC1',
            'vectorStakeUSDC2',
            'vectorUnstakeUSDC2',
            'vectorStakeWAVAX1',
            'vectorUnstakeWAVAX1',
            'vectorStakeSAVAX1',
            'vectorUnstakeSAVAX1'
        ])
    }
    if (chain == 'CELO') {
        await deployFacet("UbeswapDEXFacet", diamondAddress, ['swapUbeswap'])
    }
    await deployFacet(
        "SmartLoanLiquidationFacet",
        diamondAddress,
        [
            'liquidateLoan',
            'unsafeLiquidateLoan',
            'getMaxLiquidationBonus'
        ]
    )
    await deployFacet(
        "SmartLoanViewFacet",
        diamondAddress,
        [
            'initialize',
            'getAllAssetsBalances',
            'getAllAssetsPrices',
            'getBalance',
            'getSupportedTokensAddresses',
            'getAllOwnedAssets',
        ]
    )
};

export const extractAssetNameBalances = async function (
    wrappedLoan: any
) {
    let assetsNamesBalances = await wrappedLoan.getAllAssetsBalances();
    let result: any = {};
    for (const assetNameBalance of assetsNamesBalances) {
        result[fromBytes32(assetNameBalance[0])] = assetNameBalance[1];
    }
    return result;
}

export const extractAssetNamePrices = async function (
    wrappedLoan: any
) {
    let assetsNamesPrices = await wrappedLoan.getAllAssetsPrices();
    let result: any = {};
    for (const assetNamePrice of assetsNamesPrices) {
        result[fromBytes32(assetNamePrice[0])] = assetNamePrice[1];
    }
    return result;
}


export const deployAndInitExchangeContract = async function (
    owner: SignerWithAddress,
    routerAddress: string,
    supportedAssets: string[],
    name: string
) {
    let exchangeFactory = await ethers.getContractFactory(name);
    const exchange = (await exchangeFactory.deploy()).connect(owner);
    await exchange.initialize(routerAddress, supportedAssets);
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

export async function deployAndInitializeLendingPool(owner: any, tokenName: string, tokenAirdropList: any, chain = 'AVAX') {

    const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
    let pool = (await deployContract(owner, PoolArtifact)) as Pool;
    let tokenContract: any;
    if (chain === 'AVAX') {
        switch (tokenName) {
            case 'MCKUSD':
                //it's a mock implementation of USD token with 18 decimal places
                tokenContract = (await deployContract(owner, MockTokenArtifact, [tokenAirdropList])) as MockToken;
                break;
            case 'AVAX':
                tokenContract = new ethers.Contract(AVAX_TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);
                for (const user of tokenAirdropList) {
                    await tokenContract.connect(user).deposit({value: toWei("1000")});
                }
                break;
            case 'ETH':
                tokenContract = new ethers.Contract(AVAX_TOKEN_ADDRESSES['ETH'], erc20ABI, provider);
                break;
            case 'USDC':
                tokenContract = new ethers.Contract(AVAX_TOKEN_ADDRESSES['USDC'], erc20ABI, provider);
                break;
        }
    } else if (chain === 'CELO') {
        switch (tokenName) {
            case 'MCKUSD':
                //it's a mock implementation of USD token with 18 decimal places
                tokenContract = (await deployContract(owner, MockTokenArtifact, [tokenAirdropList])) as MockToken;
                break;
            case 'CELO':
                tokenContract = new ethers.Contract(CELO_TOKEN_ADDRESSES['CELO'], erc20ABI, provider);
                break;
            case 'mcUSD':
                tokenContract = new ethers.Contract(CELO_TOKEN_ADDRESSES['mcUSD'], erc20ABI, provider);
                break;
            case 'ETH':
                tokenContract = new ethers.Contract(CELO_TOKEN_ADDRESSES['ETH'], erc20ABI, provider);
                break;
        }
    }

    const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
    const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
    const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
    await pool.initialize(
        variableUtilisationRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address,
        tokenContract!.address
    );
    return {'poolContract': pool, 'tokenContract': tokenContract}
}

export async function recompileConstantsFile(chain: string, contractName: string, exchanges: Array<{ facetPath: string, contractAddress: string }>, tokenManagerAddress: string, redstoneConfigManagerAddress: string, diamondBeaconAddress: string, smartLoansFactoryAddress: string, subpath: string, maxLTV: number = 5000, minSelloutLTV: number = 4000, maxLiquidationBonus: number = 100, nativeAssetSymbol: string = 'AVAX') {
    const subPath = subpath ? subpath + '/' : "";
    const artifactsDirectory = `../artifacts/contracts/${subPath}/${chain}/${contractName}.sol/${contractName}.json`;
    delete require.cache[require.resolve(artifactsDirectory)]
    await updateConstants(chain, exchanges, tokenManagerAddress, redstoneConfigManagerAddress, diamondBeaconAddress, smartLoansFactoryAddress, maxLTV, minSelloutLTV, maxLiquidationBonus, nativeAssetSymbol);
    execSync(`npx hardhat compile`, {encoding: 'utf-8'});
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

export class AssetNamePrice {
    name: string;
    price: BigNumber;

    constructor(name: string, price: BigNumber) {
        this.name = name;
        this.price = price;
    }
}

export class AssetNameBalance {
    name: string;
    balance: BigNumber;

    constructor(name: string, balance: BigNumber) {
        this.name = name;
        this.balance = balance;
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
