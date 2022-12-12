import {Subject} from 'rxjs';

export default class AssetBalancesExternalUpdateService {

  constructor() {
    console.log('refresh service constructor');
    console.log(performance.now());
  }

  refresh$ = new Subject();
  assetBalanceExternalUpdate$ = new Subject();
  created = performance.now();

  emit() {
    console.log('RefreshService.emit()');
    this.refresh$.next(123);
  }

  emitExternalAssetBalanceUpdate(assetSymbol, balance, isLP = false) {
    console.log('emiting update: ', assetSymbol, balance);
    this.assetBalanceExternalUpdate$.next({assetSymbol: assetSymbol, balance: balance, isLP: isLP});
  }
};