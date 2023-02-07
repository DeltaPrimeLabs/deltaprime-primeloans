import {Subject} from 'rxjs';

export default class DataRefreshEventService {

  assetBalancesDataRefreshEvent$ = new Subject();
  assetBalancesDataRefresh$ = new Subject();
  debtsPerAssetDataRefreshEvent$ = new Subject();
  hardRefreshScheduledEvent$ = new Subject();

  emitAssetBalancesDataRefreshEvent(assetBalancesRefreshEvent) {
    console.log('emitAssetBalancesDataRefreshEvent');
    this.assetBalancesDataRefreshEvent$.next(assetBalancesRefreshEvent);
  }

  emitAssetBalancesDataRefresh() {
    console.log('emitAssetBalancesDataRefreshEvent');
    this.assetBalancesDataRefresh$.next(null);
  }

  emitDebtsPerAssetDataRefreshEvent(debtsPerAsset) {
    console.log('emitDebtsPerAssetDataRefreshEvent');
    this.debtsPerAssetDataRefreshEvent$.next(debtsPerAsset);
  }

  emitHardRefreshScheduledEvent() {
    this.hardRefreshScheduledEvent$.next(null);
  }

  observeAssetBalancesDataRefresh() {
    return this.assetBalancesDataRefresh$.asObservable();
  }

  observeDebtsPerAssetDataRefresh() {
    return this.debtsPerAssetDataRefreshEvent$.asObservable();
  }

}
