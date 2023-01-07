import {Subject} from 'rxjs';

export default class HealthService {
  refreshHealth$ = new Subject();

  emitRefreshHealth() {
    this.refreshHealth$.next(null);
  }

  observeRefreshHealth() {
    return this.refreshHealth$.asObservable();
  }
};