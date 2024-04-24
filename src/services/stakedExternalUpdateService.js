import {Subject} from 'rxjs';

export default class StakedExternalUpdateService {

  totalStakedExternalUpdate$ = new Subject();
  stakedPerFarmExternalUpdate$ = new Subject();

  emitExternalTotalStakedUpdate(assetSymbol, stakedChange, action, isTrueData = false) {
    this.totalStakedExternalUpdate$.next({
      assetSymbol: assetSymbol,
      stakedChange: stakedChange,
      action: action,
      isTrueData: isTrueData
    });
  }

  emitExternalStakedBalancesPerFarmUpdate(assetSymbol, protocolIdentifier, stakedBalance, receiptTokenBalance) {
    this.stakedPerFarmExternalUpdate$.next({
      assetSymbol: assetSymbol,
      protocolIdentifier: protocolIdentifier,
      stakedBalance: stakedBalance,
      receiptTokenBalance: receiptTokenBalance,
    });
  }

  observeExternalTotalStakedUpdate() {
    return this.totalStakedExternalUpdate$.asObservable();
  }

  observeExternalStakedBalancesPerFarmUpdate() {
    return this.stakedPerFarmExternalUpdate$.asObservable();
  }
};