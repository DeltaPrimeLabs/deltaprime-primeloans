import {Subject} from 'rxjs';

export default class FarmService {
  refreshFarm$ = new Subject();
  farms$ = new Subject();

  emitRefreshFarm() {
    this.refreshFarm$.next(null);
  }

  emitFarms(farms) {
    this.farms$.next(farms);
  }

  observeRefreshFarm() {
    return this.refreshFarm$.asObservable();
  }

  observeFarms() {
    return this.farms$.asObservable();
  }
};