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

  async calculateHealth(noSmartLoan, debtsPerAsset, assets, assetBalances, lpAssets, lpBalances, concentratedLpAssets, concentratedLpBalances, traderJoeV2LpAssets, stakeStoreFarms) {
    console.log('healthService.calculateHealth()');
    if (noSmartLoan) {
      console.log('healthService - noSmartLoan');
      return 1;
    }

    const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
    const redstonePriceData = await redstonePriceDataRequest.json();

    console.log(debtsPerAsset);

    if (debtsPerAsset && assets && assetBalances && lpAssets && lpBalances && stakeStoreFarms) {
      let tokens = [];
      for (const [symbol, data] of Object.entries(assets)) {
        let borrowed = debtsPerAsset[symbol] ? parseFloat(debtsPerAsset[symbol].debt) : 0;

        tokens.push({
          price: redstonePriceData[symbol][0].dataPoints[0].value,
          balance: parseFloat(assetBalances[symbol]),
          borrowed: borrowed,
          debtCoverage: data.debtCoverage,
          symbol: symbol
        });
      }

      for (const [symbol, data] of Object.entries(lpAssets)) {
        tokens.push({
          price: redstonePriceData[symbol][0].dataPoints[0].value,
          balance: parseFloat(lpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage,
          symbol: symbol

        });
      }

      for (const [symbol, data] of Object.entries(concentratedLpAssets)) {
        tokens.push({
          price: redstonePriceData[symbol][0].dataPoints[0].value,
          balance: parseFloat(concentratedLpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage,
          symbol: symbol
        });
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

      const health = calculateHealth(tokens, lbTokens);
      this.health$.next(health >= 0 ? health : 0);
      console.warn('EMITTING HEALTH: ', health);
      return health >= 0 ? health : 0;
    }

    this.health$.next(1);
    return 1;
  }
};