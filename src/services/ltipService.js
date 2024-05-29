import {BehaviorSubject, Subject} from 'rxjs';
import config from '../config';
import {wrapContract} from "../utils/blockchain";
import {fromWei} from "../utils/calculate";

export default class LtipService {
  primeAccountsData$ = new BehaviorSubject([]);
  primeAccountsTotalEligibleTvl$ = new BehaviorSubject(null);
  primeAccountEligibleTvl$ = new BehaviorSubject(null);
  primeAccountArbCollected$ = new BehaviorSubject(null);
  poolApyData$ = new BehaviorSubject([]);

  emitRefreshPrimeAccountsLtipData(primeAccountAddress) {
    this.updateLtipData(primeAccountAddress);
  }

  emitRefreshPrimeAccountEligibleTvl(wrappedContractPromise) {
    wrappedContractPromise.then(
        wrapped => {
          this.updatePrimeAccountEligibleTvl(wrapped);
        }
    )
  }

  emitRefreshPoolLtipData() {
    this.updatePoolLtipData();
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

  observeLtipPrimeAccountArbCollected() {
    return this.primeAccountArbCollected$.asObservable();
  }

  observeLtipPoolData() {
    return this.poolApyData$.asObservable();
  }

  async updateLtipData(primeAccountAddress) {
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
    console.log(`${config.ltipPrimeAccountArbCollected}?addresses=${primeAccountAddress}`)
    fetch(`${config.ltipPrimeAccountArbCollected}?addresses=${primeAccountAddress}`).then(
        res => res.json().then(
            json => {
              return this.primeAccountArbCollected$.next(json.data[primeAccountAddress].arbCollected)}
        )
    );
  }

  async updatePoolLtipData() {
    fetch(config.ltipPoolApyEndpoint).then(
        res => res.json().then(
            json => this.poolApyData$.next(json)
        )
    );
  }

  async updatePrimeAccountEligibleTvl(wrappedContract) {
    wrappedContract.getLTIPEligibleTVL().then(
        res => this.primeAccountEligibleTvl$.next(fromWei(res))
    )
  }
};