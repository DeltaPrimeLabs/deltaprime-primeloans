import {ethers, network, waffle} from "hardhat";
import {BigNumber, Contract, Wallet} from "ethers";
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
import redstone from "redstone-api";
import {JsonRpcSigner} from "@ethersproject/providers";

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

interface PoolInitializationObject {
    name: string,
    airdropList: Array<SignerWithAddress>
}

interface MockTokenPriceObject {
    symbol: string,
    value: number
}

export {PoolInitializationObject, MockTokenPriceObject};


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
    assets: Asset[],
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

export const deployPools = async function(
   smartLoansFactory: Contract,
   tokens: Array<PoolInitializationObject>,
   tokenContracts: Map<string, Contract>,
   poolContracts: Map<string, Contract>,
   lendingPools: Array<PoolAsset>,
   owner: SignerWithAddress | JsonRpcSigner,
   depositor: SignerWithAddress | Wallet,
   depositAmount: number = 2000,
   chain: string = 'AVAX'
) {
    for (const token of tokens) {
        let {
            poolContract,
            tokenContract
        } = await deployAndInitializeLendingPool(owner, token.name, smartLoansFactory.address, token.airdropList, chain);
        for (const user of token.airdropList) {
            await tokenContract!.connect(user).approve(poolContract.address, toWei(depositAmount.toString()));
            await poolContract.connect(user).deposit(toWei(depositAmount.toString()));
        }
        lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
        tokenContracts.set(token.name, tokenContract);
        poolContracts.set(token.name, poolContract);
    }
}

function zip(arrays: any) {
    return arrays[0].map(function(_: any,i: any){
        return arrays.map(function(array: any){return array[i]})
    });
}

export const getRedstonePrices = async function(tokenSymbols: Array<string>, priceProvider: string = "redstone-avalanche-prod-1"): Promise<Array<number>> {
    return await Promise.all(tokenSymbols.map(async (tokenSymbol: string) => (await redstone.getPrice(tokenSymbol, {provider: priceProvider})).value));
}

export const getTokensPricesMap = async function(tokenSymbols: Array<string>, priceProviderFunc: Function, additionalMockTokensPrices: Array<MockTokenPriceObject> = [], resultMap: Map<string, number> = new Map()): Promise<Map<string, number>> {
    for (const [tokenSymbol, tokenPrice] of zip([tokenSymbols, await priceProviderFunc(tokenSymbols)])) {
        resultMap.set(tokenSymbol, tokenPrice);
    }
    if(additionalMockTokensPrices.length > 0) {
        additionalMockTokensPrices.forEach(obj => (resultMap.set(obj.symbol, obj.value)));
    }
    return resultMap
}

export const convertTokenPricesMapToMockPrices = function(tokensPrices: Map<string, number>) {
    return Array.from(tokensPrices).map( ([token, price]) => ({symbol: token, value: price}));
}

export const convertAssetsListToSupportedAssets = function(assetsList: Array<string>, customTokensAddresses: any = [], chain = 'AVAX') {
    const tokenAddresses = chain === 'AVAX' ? AVAX_TOKEN_ADDRESSES : CELO_TOKEN_ADDRESSES
    return assetsList.map(asset => {
        // @ts-ignore
        return new Asset(toBytes32(asset), tokenAddresses[asset] === undefined ? customTokensAddresses[asset] : tokenAddresses[asset]);
    });
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
    const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress);
    console.log('Pausing')
    await diamondCut.pause();
    await deployFacet(
        "OwnershipFacet",
        diamondAddress,
        [
            'proposeOwnershipTransfer',
            'acceptOwnership',
            'owner',
            'proposedOwner'
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
        await deployFacet("PangolinDEXFacet", diamondAddress, ['swapPangolin', 'addLiquidityPangolin', 'removeLiquidityPangolin'])
        await deployFacet("TraderJoeDEXFacet", diamondAddress, ['swapTraderJoe', 'addLiquidityTraderJoe', 'removeLiquidityTraderJoe'])
        await deployFacet("YieldYakFacet", diamondAddress, ['stakeAVAXYak', 'stakeSAVAXYak' ,'unstakeAVAXYak', 'unstakeSAVAXYak', 'stakeTJAVAXUSDCYak', 'unstakeTJAVAXUSDCYak'])
        await deployFacet("BeefyFinanceAvalancheFacet", diamondAddress, ['stakePngUsdcAvaxLpBeefy', 'stakePngUsdceAvaxLpBeefy' ,'stakeTjUsdcAvaxLpBeefy', 'unstakePngUsdcAvaxLpBeefy', 'unstakePngUsdceAvaxLpBeefy', 'unstakeTjUsdcAvaxLpBeefy'])
        await deployFacet("VectorFinanceFacet", diamondAddress, [
                'vectorStakeUSDC1',
                'vectorUnstakeUSDC1',
                'vectorUSDC1Balance',
                'vectorStakeUSDC2',
                'vectorUnstakeUSDC2',
                'vectorUSDC2Balance',
                'vectorStakeWAVAX1',
                'vectorUnstakeWAVAX1',
                'vectorWAVAX1Balance',
                'vectorStakeSAVAX1',
                'vectorUnstakeSAVAX1',
                'vectorSAVAX1Balance'
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
            'getDebts',
            'getPercentagePrecision',
            'getAllAssetsPrices',
            'getBalance',
            'getSupportedTokensAddresses',
            'getAllOwnedAssets',
        ]
    )
    await diamondCut.unpause();
    console.log('Unpaused')
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


function getMissingTokenContracts(assetsList: Array<string>, tokenContracts: Map<string, Contract>) {
    return assetsList.filter(asset => !Array.from(tokenContracts.keys()).includes(asset))
}


export const addMissingTokenContracts = function (tokensContract: Map<string, Contract>, assetsList: Array<string>, chain: string = 'AVAX') {
    let missingTokens: Array<string> = getMissingTokenContracts(assetsList, tokensContract);
    const tokenAddresses = chain === 'AVAX' ? AVAX_TOKEN_ADDRESSES : CELO_TOKEN_ADDRESSES
    for (const missingToken of missingTokens) {
        // @ts-ignore
        tokensContract.set(missingToken, new ethers.Contract(tokenAddresses[missingToken] , wavaxAbi, provider));
    }
}

export const deployAndInitExchangeContract = async function (
    owner: SignerWithAddress | JsonRpcSigner,
    routerAddress: string,
    supportedAssets: Array<Asset>,
    name: string
) {
    let exchangeFactory = await ethers.getContractFactory(name);
    const exchange = (await exchangeFactory.deploy()).connect(owner);
    await exchange.initialize(routerAddress, supportedAssets.map(asset => asset.assetAddress));
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

export async function deployAndInitializeLendingPool(owner: any, tokenName: string, smartLoansFactoryAddress: string, tokenAirdropList: any, chain = 'AVAX', rewarder: string = '') {

    const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
    let pool = (await deployContract(owner, PoolArtifact)) as Pool;
    let tokenContract: any;
    if (chain === 'AVAX') {
        switch (tokenName) {
            case 'MCKUSD':
                //it's a mock implementation of USD token with 18 decimal places
                tokenContract = (await deployContract(owner, MockTokenArtifact, [tokenAirdropList.map((user: SignerWithAddress) => user.address)])) as MockToken;
                break;
            case 'AVAX':
                tokenContract = new ethers.Contract(AVAX_TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);
                for (const user of tokenAirdropList) {
                    await tokenContract.connect(user).deposit({value: toWei("2000")});
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

    rewarder = rewarder !== '' ? rewarder : ethers.constants.AddressZero;

    const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
    const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
    await pool.initialize(
        variableUtilisationRatesCalculator.address,
        smartLoansFactoryAddress,
        depositIndex.address,
        borrowingIndex.address,
        tokenContract!.address,
        rewarder
    );
    return {'poolContract': pool, 'tokenContract': tokenContract}
}

export async function recompileConstantsFile(chain: string, contractName: string, exchanges: Array<{ facetPath: string, contractAddress: string }>, tokenManagerAddress: string, redstoneConfigManagerAddress: string, diamondBeaconAddress: string, smartLoansFactoryAddress: string, subpath: string, maxLTV: number = 5000, minSelloutLTV: string = "1.042e18", maxLiquidationBonus: number = 100, nativeAssetSymbol: string = 'AVAX') {
    const subPath = subpath ? subpath + '/' : "";
    const artifactsDirectory = `../artifacts/contracts/${subPath}/${chain}/${contractName}.sol/${contractName}.json`;
    delete require.cache[require.resolve(artifactsDirectory)]
    await updateConstants(chain, exchanges, tokenManagerAddress, redstoneConfigManagerAddress, diamondBeaconAddress, smartLoansFactoryAddress, maxLTV, minSelloutLTV, maxLiquidationBonus, nativeAssetSymbol);
    execSync(`npx hardhat compile`, {encoding: 'utf-8', stdio: "ignore"});
    return require(artifactsDirectory);
}

export class Asset {
    asset: string;
    assetAddress: string;
    maxLeverage: BigNumber;

    constructor(asset: string, assetAddress: string, maxLeverage: number = 0.8333333333333333) {
        this.asset = asset;
        this.assetAddress = assetAddress;
        this.maxLeverage = toWei(maxLeverage.toString());
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

export class AssetNameDebt {
    name: string;
    debt: BigNumber;

    constructor(name: string, debt: BigNumber) {
        this.name = name;
        this.debt = debt;
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
