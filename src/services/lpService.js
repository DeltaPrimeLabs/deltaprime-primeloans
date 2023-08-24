import {Subject} from 'rxjs';

export default class LpService {
  refreshLp$ = new Subject();

  emitRefreshLp(lpType) {
    this.refreshLp$.next(lpType);
  }

  observeRefreshLp() {
    return this.refreshLp$.asObservable();
  }
};