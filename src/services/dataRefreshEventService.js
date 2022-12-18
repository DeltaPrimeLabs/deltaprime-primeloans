import {Subject} from 'rxjs';

export default class DataRefreshEventService {

  assetBalancesDataRefreshEvent$ = new Subject();
  debtsPerAssetDataRefreshEvent$ = new Subject();

  emitAssetBalancesDataRefreshEvent() {
    console.log('emitAssetBalancesDataRefreshEvent');
    this.assetBalancesDataRefreshEvent$.next(null);
  }

  emitDebtsPerAssetDataRefreshEvent() {
    console.log('emitDebtsPerAssetDataRefreshEvent');
    this.debtsPerAssetDataRefreshEvent$.next(null);
  }
}
