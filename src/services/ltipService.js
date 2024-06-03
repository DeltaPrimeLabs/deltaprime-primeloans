import {BehaviorSubject, Subject} from 'rxjs';
import config from '../config';
import {wrapContract} from "../utils/blockchain";
import {fromWei} from "../utils/calculate";
import DataRefreshEventService from "./dataRefreshEventService";

export default class LtipService {
  primeAccountsData$ = new BehaviorSubject(null);
  primeAccountsTotalEligibleTvl$ = new BehaviorSubject(null);
  primeAccountEligibleTvl$ = new BehaviorSubject(null);
  primeAccountArbCollected$ = new BehaviorSubject(null);
  poolApyData$ = new BehaviorSubject([]);
  ltipMaxBoostApy$ = new BehaviorSubject(null);

  emitRefreshPrimeAccountsLtipData(primeAccountAddress, arbPrice, dataRefreshEventService) {
    this.updateLtipData(primeAccountAddress, arbPrice, dataRefreshEventService);
  }

  emitRefreshPrimeAccountEligibleTvl(wrappedContractPromise) {
    console.log('emitRefreshPrimeAccountEligibleTvl');
    wrappedContractPromise.then(
        wrapped => {
          this.updatePrimeAccountEligibleTvl(wrapped);
        }
    )
  }

  emitRefreshPoolLtipData() {
    this.updatePoolLtipData();
  }

  emitRefreshLtipMaxBoostApy(arbPrice, arbApy) {
    this.updateLtipMaxBoostApy(arbPrice, arbApy);
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

  observeLtipMaxBoostApy() {
    return this.ltipMaxBoostApy$.asObservable();
  }

  async updateLtipData(primeAccountAddress, arbPrice, dataRefreshEventService) {
    console.log('updateLtipData');
    fetch(`${config.ltipAccountsLeaderboardEndpoint}?top=200&from=${config.ltipLastDistributionTimestamp}&to=${Math.floor(Date.now() / 1000)}`).then(
        res => res.json().then(
            json => this.primeAccountsData$.next(json.list)
        )
    );
    fetch(config.ltipApyEndpoint).then(
        res => res.json().then(
            json => this.primeAccountsTotalEligibleTvl$.next(json.totalEligibleTvl)
        )
    );
    fetch(`${config.ltipPrimeAccountArbCollected}?addresses=${primeAccountAddress}`).then(
        res => res.json().then(
            json => {
              return this.primeAccountArbCollected$.next(json.data[primeAccountAddress].arbCollected)}
        )
    );

    fetch(`${config.ltipApyEndpoint}`).then(
        res => res.json().then(
            json => {
              this.updateLtipMaxBoostApy(arbPrice, json.arbApy, dataRefreshEventService)}
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

  updateLtipMaxBoostApy(arbPrice, arbApy, dataRefreshEventService) {
     this.ltipMaxBoostApy$.next(4.5 * arbPrice * arbApy);
    dataRefreshEventService.emitAssetApysDataRefresh();
  }

  async updatePrimeAccountEligibleTvl(wrappedContract) {
    wrappedContract.getLTIPEligibleTVL().then(
        res => {
          this.primeAccountEligibleTvl$.next(fromWei(res));
        }
    )
  }
};