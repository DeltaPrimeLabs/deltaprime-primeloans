import {Subject} from 'rxjs';

export default class DebtService {

  debt$ = new Subject();

  emitDebt(debt) {
    console.log('emitting new debt:', debt);
    this.debt$.next(debt);
  }

  observeDebt() {
    return this.debt$.asObservable();
  }
}