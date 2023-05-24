import {Subject} from 'rxjs';

export default class WalletAssetBalancesService {
  walletAssetBalances$ = new Subject();

  emitWalletAssetBalances(walletAssetBalances) {
    console.log(walletAssetBalances);
    this.walletAssetBalances$.next(walletAssetBalances);
  }

  observeWalletAssetBalances() {
    return this.walletAssetBalances$.asObservable();
  }
}
