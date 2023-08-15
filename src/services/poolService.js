import {combineLatest, map, Subject} from 'rxjs';
import config from '../config';
import POOL from '@artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import {formatUnits, fromWei, parseUnits} from '@/utils/calculate';
import redstone from 'redstone-api';


const ethers = require('ethers');

export default class PoolService {
  pools$ = new Subject();
  pools = [];

  emitPools(pools) {
    console.log('emitting pools', pools);
    this.pools = pools;
    this.pools$.next(pools);
  }

  observePools() {
    return this.pools$.asObservable();
  }

  setupPools(provider, account, redstonePriceData) {
    const poolsFromConfig = Object.keys(config.POOLS_CONFIG);

    return combineLatest(
      poolsFromConfig.map(poolAsset => {
        const poolContract = new ethers.Contract(config.POOLS_CONFIG[poolAsset].address, POOL.abi, provider.getSigner());
        console.log(poolContract);
        return combineLatest([
          poolContract.totalSupply(),
          poolContract.balanceOf(account),
          poolContract.getDepositRate(),
          poolContract.getBorrowingRate(),
          poolContract.totalBorrowed(),
          poolContract.getMaxPoolUtilisationForBorrowing()
        ]).pipe(map(poolDetails => {
          console.log(poolDetails);
          const deposit = formatUnits(String(poolDetails[1]), config.ASSETS_CONFIG[poolAsset].decimals);
          const apy = fromWei(poolDetails[2]);
          const totalBorrowed = formatUnits(String(poolDetails[4]), config.ASSETS_CONFIG[poolAsset].decimals);
          const tvl = formatUnits(String(poolDetails[0]), config.ASSETS_CONFIG[poolAsset].decimals);
          const pool = {
            asset: config.ASSETS_CONFIG[poolAsset],
            assetPrice: redstonePriceData[poolAsset][0].dataPoints[0].value,
            contract: poolContract,
            tvl: tvl,
            deposit: deposit,
            apy: apy,
            borrowingAPY: fromWei(poolDetails[3]),
            totalBorrowed: totalBorrowed,
            interest: deposit * apy / 365,
            maxUtilisation: fromWei(poolDetails[5]),
            utilisation: totalBorrowed / tvl,
          };
          return pool;
        }))
      })
    )
  }

  emitPoolDepositChange(amount, poolAssetSymbol, operation) {
    console.log(`emitting ${poolAssetSymbol} deposit change: ${amount}, ${operation}`);
    const pool = this.pools.find(pool => pool.asset.symbol === poolAssetSymbol);
    if (operation === 'DEPOSIT') {
      pool.deposit = Number(pool.deposit) + Number(amount);
    } else if (operation === 'WITHDRAW') {
      pool.deposit = Math.max(pool.deposit - amount, 0);
    }
    this.emitPools(this.pools);
  }
};