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

export async function yieldYakBalance(stakingContractAddress, address) {
  const tokenContract = new ethers.Contract(stakingContractAddress, erc20ABI, provider.getSigner());
  const totalSupply = Number(await tokenContract.totalSupply());
  const totalDeposits = Number(await tokenContract.totalDeposits());
  const yrtToAvaxConversionRate = totalDeposits / totalSupply;
  const stakedYrtWei = await tokenContract.balanceOf(address);
  const stakedYrt = Number(fromWei(stakedYrtWei));

  return stakedYrt * yrtToAvaxConversionRate;
}

export async function vectorFinanceBalance(stakingContractAddress, address, decimals = 18) {
  const tokenContract = new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider.getSigner());

  return formatUnits(await tokenContract.balance(address), BigNumber.from(decimals.toString()));
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

  const pairDayDatasQuery = gql(`
    query pairDayDatasQuery(
      $first: Int = 1000
      $date: Int = 0
      $pairs: [Bytes]!
    ) {
      pairDayDatas(
        first: $first
        orderBy: date
        orderDirection: desc
        where: { pair_in: $pairs, date_gt: $date }
      ) {
        date
        pair {
          id
        }
        token0 {
          derivedAVAX
        }
        token1 {
          derivedAVAX
        }
        reserveUSD
        volumeToken0
        volumeToken1
        volumeUSD
        txCount
      }
    }
  `);

  const pairTokenFieldsQuery = `
    fragment pairTokenFields on Token {
      id
      name
      symbol
      totalSupply
      derivedAVAX
    }
  `;

  const pairFieldsQuery = `
    fragment pairFields on Pair {
      id
      reserveUSD
      reserveAVAX
      volumeUSD
      untrackedVolumeUSD
      trackedReserveAVAX
      token0 {
        ...pairTokenFields
      }
      token1 {
        ...pairTokenFields
      }
      reserve0
      reserve1
      token0Price
      token1Price
      totalSupply
      txCount
      timestamp
    }
    ${pairTokenFieldsQuery}
  `;

  const pairQuery = gql(`
    query pairQuery($id: String!) {
      pair(id: $id) {
        ...pairFields
      }
    }
    ${pairFieldsQuery}
  `);

  const client = new ApolloClient({
    uri: tjSubgraphUrl
  });
  //
  const firstResponse = await client.query({query: pairDayDatasQuery, variables: {
    pairs: [
      lpAddress.toLowerCase()
      ],
      first: 1,
      date: 0
    }});


  const secondResponse = await client.query({query: pairDayDatasQuery, variables: {
      pairs: [
        lpAddress.toLowerCase()
      ],
      first: 1000,
      date: 86400000
    }});

  const response = await client.query({query: pairQuery, variables: { id: lpAddress.toLowerCase()}});

  let volumeUSD = parseFloat(response.data.pair.volumeUSD);
  let reserveUSD = parseFloat(response.data.pair.reserveUSD);

  // const volume = volumeUSD - parseFloat(oneDayVolumeUSD);

  // const feesUSD = volume * FEE_RATE;

  // return feesUSD * 365 / reserveUSD;
  return 0;
}

export const fromWei = val => parseFloat(ethers.utils.formatEther(val));
export const toWei = ethers.utils.parseEther;
export const parseUnits = ethers.utils.parseUnits;
export const formatUnits = ethers.utils.formatUnits;
