import {BehaviorSubject, Subject} from 'rxjs';
import config from '../config';
import {wrapContract} from "../utils/blockchain";
import {fromWei} from "../utils/calculate";

export default class LtipService {
  primeAccountsData$ = new BehaviorSubject([]);
  primeAccountsTotalEligibleTvl$ = new BehaviorSubject(null);
  primeAccountEligibleTvl$ = new BehaviorSubject(null);

  emitRefreshPrimeAccountsLtipData() {
    this.updateLtipData();
  }

  emitRefreshPrimeAccountEligibleTvl(wrappedContractPromise) {
    wrappedContractPromise.then(
        wrapped => {
          this.updatePrimeAccountEligibleTvl(wrapped);
        }
    )
  }

  observeLtipAccountsData() {
    return this.primeAccountsData$.asObservable();
  }

  observeLtipTotalEligibleTvlData() {
    return this.primeAccountsTotalEligibleTvl$.asObservable();
  }

  observeLtipPrimeAccountEligibleTvl() {
    return this.primeAccountEligibleTvl$.asObservable();
  }

  async updateLtipData() {
    fetch(config.ltipAccountsDataEndpoint).then(
        res => res.json().then(
            json => this.primeAccountsData$.next(json.list)
        )
    );
    fetch(config.ltipApyEndpoint).then(
        res => res.json().then(
            json => this.primeAccountsTotalEligibleTvl$.next(json.totalEligibleTvl)
        )
    );
  }

  async updatePrimeAccountEligibleTvl(wrappedContract) {
    wrappedContract.getLTIPEligibleTVL().then(
        res => this.primeAccountEligibleTvl$.next(fromWei(res))
    )
  }
};