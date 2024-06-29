import {BehaviorSubject, Subject} from 'rxjs';
import config from '../config';
import {wrapContract} from "../utils/blockchain";
import {fillBinsArray, formatUnits, fromWei, getBinPrice, uniswapV3TickToPrice} from "../utils/calculate";
import SPRIME from '@artifacts/contracts/interfaces/ISPrime.sol/ISPrime.json';
import UNI_V3_POSITION_MANAGER from '@artifacts/contracts/interfaces/uniswap-v3-periphery/INonfungiblePositionManager.sol/INonfungiblePositionManager.json';
import TRADERJOE_V2_POSITION_MANAGER from '@artifacts/contracts/interfaces/IPositionManager.sol/IPositionManager.json';
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

      fetch(config.redstoneFeedUrl).then(
          res => {
              res.json().then(
                  redstonePriceData => {
                      let secondAssetPrice = redstonePriceData[secondAsset][0].dataPoints[0].value;

                      if (dex === 'UNISWAP') {
                          sPrimeContract['getUserValueInTokenY(address)'](ownerAddress).then(
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

                          sPrimeContract.userTokenId(ownerAddress).then(
                              tokenId => {
                                  let positionManager = new ethers.Contract(config.SPRIME_CONFIG[dex][secondAsset].positionManagerAddress, UNI_V3_POSITION_MANAGER.abi, provider.getSigner());

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

                      if (dex === 'TRADERJOEV2') {
                          sPrimeContract.getPoolPrice().then(
                              poolPrice => {
                                  sPrimeContract['getUserValueInTokenY(address,uint256)'](ownerAddress, poolPrice).then(
                                      async value => {
                                          value = formatUnits(value, config.ASSETS_CONFIG[secondAsset].decimals) * secondAssetPrice;

                                          this.sPrimeValue$.next(value)
                                      }
                                  );

                                  this.poolPrice$.next(poolPrice * secondAssetPrice / 1e8)
                              }
                          );

                          sPrimeContract.getUserTokenId(ownerAddress).then(
                              tokenId => {
                                  let positionManager = new ethers.Contract(config.SPRIME_CONFIG[dex][secondAsset].positionManagerAddress, TRADERJOE_V2_POSITION_MANAGER.abi, provider.getSigner());

                                  positionManager.positions(tokenId).then(
                                      res => {
                                          let centerId = res.centerId;
                                          let numberOfBins = res.liquidityMinted.length;
                                          let binsArray = fillBinsArray(centerId, numberOfBins);
                                          binsArray = binsArray.map(
                                              binId => secondAssetPrice * getBinPrice(binId, config.SPRIME_CONFIG[dex][secondAsset].binStep, 18, config.SPRIME_CONFIG[dex][secondAsset].secondAssetDecimals)
                                          )

                                          this.sPrimePositionInfo$.next(
                                              {
                                                  binsArray: binsArray
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
};