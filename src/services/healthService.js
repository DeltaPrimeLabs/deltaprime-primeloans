import {Subject} from 'rxjs';
import {calculateHealth} from '../utils/calculate';
import config from '../config';

export default class HealthService {
  refreshHealth$ = new Subject();
  health$ = new Subject();

  emitRefreshHealth() {
    this.refreshHealth$.next(null);
  }

  observeRefreshHealth() {
    return this.refreshHealth$.asObservable();
  }

  observeHealth() {
    return this.health$.asObservable();
  }

  async calculateHealth(noSmartLoan, debtsPerAsset, assets, assetBalances, lpAssets, lpBalances, concentratedLpAssets, concentratedLpBalances, levelAssets, levelBalances, gmxV2Assets, gmxV2Balances, traderJoeV2LpAssets, stakeStoreFarms) {
    if (noSmartLoan) {
      return 1;
    }
    const someFarmsNotLoaded = Object.values(stakeStoreFarms).some((token) => {
      return token.some(bin => {
        return !bin.totalBalance || typeof bin.totalBalance === 'number'
      })
    })
    if (someFarmsNotLoaded) {
      return;
    }

    const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
    const redstonePriceData = await redstonePriceDataRequest.json();

    if (debtsPerAsset && assets && assetBalances && lpAssets && lpBalances && stakeStoreFarms) {
      let tokens = [];
      for (const [symbol, data] of Object.entries(assets)) {
        let borrowed = debtsPerAsset[symbol] ? parseFloat(debtsPerAsset[symbol].debt) : 0;

        tokens.push({
          price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
          balance: parseFloat(assetBalances[symbol]),
          borrowed: borrowed,
          debtCoverage: data.debtCoverage,
          symbol: symbol
        });
      }

      for (const [symbol, data] of Object.entries(lpAssets)) {
        tokens.push({
          price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
          balance: parseFloat(lpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage,
          symbol: symbol

        });
      }

      for (const [symbol, data] of Object.entries(concentratedLpAssets)) {
        tokens.push({
          price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
          balance: parseFloat(concentratedLpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage,
          symbol: symbol
        });
      }

      if (levelAssets) {
        for (const [symbol, data] of Object.entries(levelAssets)) {
          tokens.push({
            price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
            balance: parseFloat(levelBalances[symbol]),
            borrowed: 0,
            debtCoverage: data.debtCoverage,
            symbol: symbol
          });
        }
      }

      if (gmxV2Assets) {
        for (const [symbol, data] of Object.entries(gmxV2Assets)) {
          tokens.push({
            price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
            balance: parseFloat(gmxV2Balances[symbol]),
            borrowed: 0,
            debtCoverage: data.debtCoverage,
            symbol: symbol
          });
        }
      }

      for (const [symbol, farms] of Object.entries(stakeStoreFarms)) {
        farms.forEach(farm => {
          let feedSymbol = farm.feedSymbol ? farm.feedSymbol : symbol;

          tokens.push({
            price: redstonePriceData[feedSymbol] ? redstonePriceData[feedSymbol][0].dataPoints[0].value : 0,
            balance: parseFloat(farm.totalBalance),
            borrowed: 0,
            debtCoverage: farm.debtCoverage,
            symbol: symbol
          });
        });
      }

      let lbTokens = Object.values(traderJoeV2LpAssets);

      console.log('tokens')
      console.log(tokens)
      const health = calculateHealth(tokens, lbTokens);
      this.health$.next(health >= 0 ? health : 0);

      return health >= 0 ? health : 0;
    }

    this.health$.next(1);
    return 1;
  }
};
