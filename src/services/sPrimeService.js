import {BehaviorSubject, Subject} from 'rxjs';
import config from '../config';
import {wrapContract} from "../utils/blockchain";
import {formatUnits, fromWei, uniswapV3TickToPrice} from "../utils/calculate";
import SPRIME from '@artifacts/contracts/interfaces/ISPrime.sol/ISPrime.json';
import UNI_V3_POSITION_MANAGER from '@artifacts/contracts/interfaces/uniswap-v3-periphery/INonFungiblePositionManager.sol/INonFungiblePositionManager.json';
const ethers = require('ethers');

export default class sPrimeService {
  sPrimeValue$ = new BehaviorSubject(null);
  sPrimePositionInfo$ = new BehaviorSubject(null);
  poolPrice$  = new BehaviorSubject(null);

  emitRefreshSPrimeData(provider, sPrimeAddress, poolAddress, dex, secondAsset, ownerAddress) {
    this.updateSPrimeData(provider, sPrimeAddress, poolAddress, dex, secondAsset, ownerAddress);
  }

  observeSPrimeValue() {
    return this.sPrimeValue$.asObservable();
  }

    observeSPrimeUnderlyingPool() {
        return this.poolPrice$.asObservable();
    }

    observeSPrimePositionInfo() {
        return this.sPrimePositionInfo$.asObservable();
    }

  async updateSPrimeData(provider, sPrimeAddress, poolAddress, dex, secondAsset, ownerAddress) {
      let dataFeeds = [...Object.keys(config.POOLS_CONFIG), secondAsset];

      const sPrimeContract = await wrapContract(new ethers.Contract(sPrimeAddress, SPRIME.abi, provider.getSigner()), dataFeeds);


      const poolContract =
          dex === 'TRADERJOEV2'
          ?
          new ethers.Contract(sPrimeAddress, SPRIME.abi, provider.getSigner())
          :
          new ethers.Contract(sPrimeAddress, SPRIME.abi, provider.getSigner());

      if (dex === 'TRADERJOEV2') {

      }




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
                              this.poolPrice$.next(poolPrice * secondAssetPrice / 1e8)
                          }
                      );


                      if(dex === 'UNISWAP') {
                          sPrimeContract.userTokenId(ownerAddress).then(
                              tokenId => {
                                  let positionManager =  new ethers.Contract(config.SPRIME_CONFIG[dex][secondAsset].positionManagerAddress, UNI_V3_POSITION_MANAGER.abi, provider.getSigner());

                                  positionManager.positions(tokenId).then(
                                      res => {
                                          this.sPrimePositionInfo$.next(
                                              {
                                                  priceMin: uniswapV3TickToPrice(res.tickLower) * secondAssetPrice,
                                                  priceMax: uniswapV3TickToPrice(res.tickUpper) * secondAssetPrice
                                              });
                                      }
                                  )
                              }
                          )
                      }

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