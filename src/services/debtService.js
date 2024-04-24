import {Subject} from 'rxjs';

export default class DebtService {

  debt$ = new Subject();

  emitDebt(debt) {
    this.debt$.next(debt);
  }

  observeDebt() {
    return this.debt$.asObservable();
  }
}