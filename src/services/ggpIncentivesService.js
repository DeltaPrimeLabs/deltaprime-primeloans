import {BehaviorSubject, Subject} from 'rxjs';
import config from '../config';
import {wrapContract} from "../utils/blockchain";
import {fromWei} from "../utils/calculate";
import DataRefreshEventService from "./dataRefreshEventService";

export default class GgpIncentivesService {
  collectedGGP$ = new BehaviorSubject(null);
  boostGGPApy$ = new BehaviorSubject(null);

  emitLoadData(primeAccountAddress) {
    console.log('asdas load');
    void this.loadData(primeAccountAddress);
  }

  observeCollectedGGP() {
    return this.collectedGGP$.asObservable();
  }

  observeBoostGGPApy$() {
    return this.boostGGPApy$.asObservable();
  }

  async loadData(primeAccountAddress) {
    console.log('asdas load data');
    fetch(config.ggpIncentivesEnpoints.boostApy).then(
        res => res.json().then(
            json => this.boostGGPApy$.next(json)
        )
    );

    fetch(`${config.ggpIncentivesEnpoints.collectedGGP}?addresses=${primeAccountAddress}`).then(
        res => res.json().then(
            json => this.collectedGGP$.next(Object.values(json.data)[0].ggpCollected)
        )
    );
  }
};
