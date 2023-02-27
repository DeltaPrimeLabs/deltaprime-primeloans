import {Subject} from 'rxjs';

export default class CollateralService {

  collateral$ = new Subject();

  emitCollateral(collateral) {
    console.log('emitting total collateral', collateral);
    this.collateral$.next(collateral);
  }

  observeCollateral() {
    return this.collateral$.asObservable();
  }
}