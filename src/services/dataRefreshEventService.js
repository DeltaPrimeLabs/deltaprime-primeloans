import {Subject} from 'rxjs';

export default class DataRefreshEventService {

  assetBalancesDataRefreshEvent$ = new Subject();
  assetBalancesDataRefresh$ = new Subject();
  assetApysDataRefresh$ = new Subject();
  assetUpdatedEvent$ = new Subject();
  debtsPerAssetDataRefreshEvent$ = new Subject();
  fullLoanStatusRefresh$ = new Subject();
  hardRefreshScheduledEvent$ = new Subject();

  emitAssetBalancesDataRefreshEvent(assetBalancesRefreshEvent) {
    console.log('emitAssetBalancesDataRefreshEvent');
    this.assetBalancesDataRefreshEvent$.next(assetBalancesRefreshEvent);
  }

  emitAssetBalancesDataRefresh() {
    console.log('emitAssetBalancesDataRefreshEvent');
    this.assetBalancesDataRefresh$.next(null);
  }

  emitAssetApysDataRefresh() {
    console.log('emitAssetApysDataRefreshEvent');
    this.assetApysDataRefresh$.next(null);
  }

  emitDebtsPerAssetDataRefreshEvent(debtsPerAsset) {
    console.log('emitDebtsPerAssetDataRefreshEvent');
    this.debtsPerAssetDataRefreshEvent$.next(debtsPerAsset);
  }

  emitAssetUpdatedEvent(asset) {
    console.log('emitAssetUpdatedEvent');
    this.assetUpdatedEvent$.next(asset);
  }

  emitFullLoanStatusRefresh() {
    console.log('emitFullLoanStatusRefresh');
    this.fullLoanStatusRefresh$.next(null);
  }

  emitHardRefreshScheduledEvent() {
    this.hardRefreshScheduledEvent$.next(null);
  }

  observeAssetBalancesDataRefresh() {
    return this.assetBalancesDataRefresh$.asObservable();
  }

  observeAssetApysDataRefresh() {
    return this.assetApysDataRefresh$.asObservable();
  }

  observeAssetUpdatedEvent() {
    return this.assetUpdatedEvent$.asObservable();
  }

  observeDebtsPerAssetDataRefresh() {
    return this.debtsPerAssetDataRefreshEvent$.asObservable();
  }

  observeFullLoanStatusRefresh() {
    return this.fullLoanStatusRefresh$.asObservable();
  }

}
