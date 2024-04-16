import {BehaviorSubject} from 'rxjs';

export default class DeprecatedAssetsService {

  hasDeprecatedAssets = new BehaviorSubject(false);

  emitHasDeprecatedAssets() {
    this.hasDeprecatedAssets.next(true);
  }

  observeHasDeprecatedAssets() {
    return this.hasDeprecatedAssets.asObservable();
  }
}