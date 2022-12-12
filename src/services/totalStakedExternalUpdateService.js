import {Subject} from 'rxjs';

export default class TotalStakedExternalUpdateService {

  totalStakedExternalUpdate$ = new Subject();

  emitExternalTotalStakedUpdate(assetSymbol, stakedChange, action) {
    console.log('emiting total staked update: ', assetSymbol, stakedChange);
    this.totalStakedExternalUpdate$.next({assetSymbol: assetSymbol, stakedChange: stakedChange, action: action});
  }
};