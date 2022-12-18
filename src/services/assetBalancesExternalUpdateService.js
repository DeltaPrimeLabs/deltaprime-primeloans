import {Subject} from 'rxjs';

export default class AssetBalancesExternalUpdateService {

  assetBalanceExternalUpdate$ = new Subject();

  emitExternalAssetBalanceUpdate(assetSymbol, balance, isLP = false) {
    console.log('emiting update: ', assetSymbol, balance);
    this.assetBalanceExternalUpdate$.next({assetSymbol: assetSymbol, balance: balance, isLP: isLP});
  }
};