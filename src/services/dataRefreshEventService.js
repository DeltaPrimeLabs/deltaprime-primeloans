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
    this.assetBalancesDataRefreshEvent$.next(assetBalancesRefreshEvent);
  }

  emitAssetBalancesDataRefresh() {
    this.assetBalancesDataRefresh$.next(null);
  }

  emitAssetApysDataRefresh() {
    this.assetApysDataRefresh$.next(null);
  }

  emitDebtsPerAssetDataRefreshEvent(debtsPerAsset) {
    this.debtsPerAssetDataRefreshEvent$.next(debtsPerAsset);
  }

  emitAssetUpdatedEvent(asset) {
    this.assetUpdatedEvent$.next(asset);
  }

  emitFullLoanStatusRefresh() {
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
