import config from "@/config";
const ethers = require('ethers');
import IVectorFinanceStakingArtifact
  from '../../artifacts/contracts/interfaces/IVectorFinanceStaking.sol/IVectorFinanceStaking.json';
import {BigNumber} from "ethers";
import {erc20ABI} from "./blockchain";
import ApolloClient from "apollo-boost";
import gql from "graphql-tag";

export function minAvaxToBeBought(amount, currentSlippage) {
  return amount / (1 + (currentSlippage ? currentSlippage : 0));
}

export function calculateHealth(tokens) {
  let weightedCollateral = tokens.reduce((acc, t) => acc + t.price * (t.balance - t.borrowed) * t.debtCoverage, 0);
  let weightedBorrowed = tokens.reduce((acc, t) => acc + t.price * t.borrowed * t.debtCoverage, 0);
  let borrowed = tokens.reduce((acc, t) => acc + t.price * t.borrowed, 0);

  return weightedCollateral >= 0 ? (weightedCollateral + weightedBorrowed - borrowed) / weightedCollateral : 0;
}

export function calculateMaxApy(pools, apy) {
  if (!pools) return;
  return Math.max(apy * 5.5 - 4.5 * Math.min(...Object.values(pools).map(pool => pool.borrowingAPY)), apy);
}

export function mergeArrays(arrays) {
  return [...new Set(arrays.flat())];
}

export function parseLogs(logs) {
  let loanEvents = [];

  logs.forEach(log => {
    let event = {
      type: log.name,
      time: new Date(parseInt(log.timestamp.toString()) * 1000),
      tx: log.id
    };

    if (event.type === 'Bought' || event.type === 'Sold') {
      event.asset = ethers.utils.parseBytes32String(log.toAsset);
      event.value = parseFloat(ethers.utils.formatUnits(log.amount, config.ASSETS_CONFIG[event.asset].decimals));
    } else {
      event.value = parseFloat(ethers.utils.formatEther(log.amount));
    }

    loanEvents.unshift(event);
  });

  return loanEvents;
}

export function roundWithPrecision(num, precision) {
  var multiplier = Math.pow(10, precision);
  return Math.round( num * multiplier ) / multiplier;
}

export function round(num) {
  return roundWithPrecision(num, 18);
}

export function aprToApy(apr) {
  const compoundingPeriods = 100000;
  return Math.pow(1 + (apr / compoundingPeriods), compoundingPeriods) - 1;
}

export function removePaddedTrailingZeros(numberString) {
  return numberString.replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, '$1');
}

export async function yieldYakApy(farmAddress) {
  const apysUrl = 'https://staging-api.yieldyak.com/apys';
  return (await (await fetch(apysUrl)).json())[farmAddress].apy / 100;
}

export async function vectorFinanceApy(token) {
  const apysUrl = 'https://api.vectorfinance.io/api/v1/vtx/apr';
  return (await (await fetch(apysUrl)).json()).Staking[token].total / 100;
}

export async function yieldYakRewards(stakingContractAddress, address) {
  const tokenContract = new ethers.Contract(stakingContractAddress, erc20ABI, provider.getSigner());
  const totalSupply = formatUnits(await tokenContract.totalSupply(), 18);
  const totalDeposits = formatUnits(await tokenContract.totalDeposits(), 18);
  const yrtToAvaxConversionRate = totalDeposits / totalSupply;
  const stakedYrtWei = await tokenContract.balanceOf(address);
  const stakedYrt = formatUnits(stakedYrtWei, 18);

  return stakedYrt * yrtToAvaxConversionRate - stakedYrt;
}

export async function yieldYakBalance(stakingContractAddress, address) {
  const tokenContract = new ethers.Contract(stakingContractAddress, erc20ABI, provider.getSigner());
  const stakedYrtWei = await tokenContract.balanceOf(address);

  return formatUnits(stakedYrtWei, 18);
}

export async function vectorFinanceBalance(stakingContractAddress, address, decimals = 18) {
  const tokenContract = new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider.getSigner());

  return formatUnits(await tokenContract.balance(address), BigNumber.from(decimals.toString()));
}

export async function vectorFinanceRewards(stakingContractAddress, address, decimals = 18) {
  //TODO
  return 0;
}


export async function getPangolinLpApr(url) {
  let apr;

  if (url) {
    const resp = await fetch(url);
    const json = await resp.json();

    apr = json.swapFeeApr / 100;
  } else {
    apr = 0;
  }

  return apr;
}

export async function getTraderJoeLpApr(lpAddress) {
  let tjSubgraphUrl = 'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/exchange';

  const FEE_RATE = 0.0025;

  console.log('lpAddress: ', lpAddress)
  const pairQuery = gql(`
{
  pairs(
    first: 1
    where: {id: "${lpAddress}"}
  ) {
    id
    name
    token0Price
    token1Price
    token0 {
      id
      symbol
      decimals
    }
    token1 {
      id
      symbol
      decimals
    }
    reserve0
    reserve1
    reserveUSD
    volumeUSD
    hourData(
      first: 24
      orderBy: date
      orderDirection: desc
    ) {
      volumeUSD
      date
      volumeToken0
      volumeToken1
    }
    timestamp
  }
}
`)


  const client = new ApolloClient({
    uri: tjSubgraphUrl
  });

  const response = await client.query({query: pairQuery});

  let volumeUSD = parseFloat(response.data.pairs[0].hourData.reduce((sum, data) => sum + parseFloat(data.volumeUSD), 0));
  let reserveUSD = parseFloat(response.data.pairs[0].reserveUSD);



  const feesUSD = volumeUSD * FEE_RATE;

  return feesUSD * 365 / reserveUSD;
}

export const fromWei = val => parseFloat(ethers.utils.formatEther(val));
export const toWei = ethers.utils.parseEther;
export const parseUnits = ethers.utils.parseUnits;
export const formatUnits = ethers.utils.formatUnits;
