import {Subject} from 'rxjs';

export default class WalletAssetBalancesService {
  walletAssetBalances$ = new Subject();

  emitWalletAssetBalances(walletAssetBalances) {
    this.walletAssetBalances$.next(walletAssetBalances);
  }

  observeWalletAssetBalances() {
    return this.walletAssetBalances$.asObservable();
  }
}
