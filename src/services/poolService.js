import {Subject} from 'rxjs';

export default class PoolService {
  refreshPools$ = new Subject();

  emitRefreshPools() {
    this.refreshPools$.next(null);
  }

  observeRefreshPools() {
    return this.refreshPools$.asObservable();
  }
};