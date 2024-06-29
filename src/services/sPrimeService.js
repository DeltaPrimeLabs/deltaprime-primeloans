import {BehaviorSubject, Subject} from 'rxjs';
import config from '../config';
import {wrapContract} from "../utils/blockchain";
import {formatUnits, fromWei, uniswapV3TickToPrice} from "../utils/calculate";
import SPRIME from '@artifacts/contracts/interfaces/ISPrime.sol/ISPrime.json';
const ethers = require('ethers');

export default class sPrimeService {
  sPrimeValue$ = new BehaviorSubject(null);
  poolPrice$  = new BehaviorSubject(null);

  emitRefreshSPrimeData(provider, sPrimeAddress, dex, secondAsset, ownerAddress) {
    this.updateSPrimeData(provider, sPrimeAddress, dex, secondAsset, ownerAddress);
  }

  observeSPrimeValue() {
    return this.sPrimeValue$.asObservable();
  }

    observeSPrimeUnderlyingPool() {
        return this.poolPrice$.asObservable();
    }

  async updateSPrimeData(provider, sPrimeAddress, dex, secondAsset, ownerAddress) {
      let dataFeeds = [...Object.keys(config.POOLS_CONFIG), secondAsset];

      const sPrimeContract = await wrapContract(new ethers.Contract(sPrimeAddress, SPRIME.abi, provider.getSigner()), dataFeeds);


      fetch(config.redstoneFeedUrl).then(
          res => {
              res.json().then(
                  redstonePriceData => {
                      let secondAssetPrice = redstonePriceData[secondAsset][0].dataPoints[0].value;
                      sPrimeContract.getUserValueInTokenY(ownerAddress).then(
                          async value => {
                              value = formatUnits(value, config.ASSETS_CONFIG[secondAsset].decimals) * secondAssetPrice;

                              this.sPrimeValue$.next(value)
                          }
                      );

                      sPrimeContract.getPoolPrice().then(
                          poolPrice => {
                              console.log('poolPrice: ', poolPrice)
                              console.log('poolPrice * secondAssetPrice: ', poolPrice * secondAssetPrice)
                              this.poolPrice$.next(poolPrice * secondAssetPrice / 1e8)
                          }
                      )
                  }
              )
          }
      )

  }
    async updatePoolData(poolAddress, dex, provider) {
        if (dex === 'TRADERJOEV2') {

        } else {
            const pool = new ethers.Contract(poolAddress, SPRIME.abi, provider.getSigner());
        }

    }
};