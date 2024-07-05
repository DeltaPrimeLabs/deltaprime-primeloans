import {BehaviorSubject, combineLatest, combineLatestWith, map} from "rxjs";

export const ActionSection = {
  'ASSETS': 'ASSETS',
  'POOLS': 'POOLS',
  'STAKING_PROTOCOL': 'STAKING_PROTOCOL',
  'LP': 'LP',
  'GMXV2': 'GMXV2',
  'PENPIE': 'PENPIE',
  'TRADER_JOE_LP': 'TRADER_JOE_LP',
  'LEVEL_LP': 'LEVEL_LP',
  'BALANCER_LP': 'BALANCER_LP',
  'CONCENTRATED_LP': 'CONCENTRATED_LP',
  'ZAPS': 'ZAPS',
  'SPRIME': 'SPRIME',
}

export default class GlobalActionsDisableService {
  appInReadonlyMode$ = new BehaviorSubject(false)
  assetsActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    SWAP: false,
    BORROW: false,
    REPAY: false,
    SWAP_DEBT: false,
    WRAP: false,
    CLAIM_GLP_REWARDS: false,
    WITHDRAW: false,
    BRIDGE_COLLATERAL: false,
  });
  poolsActions$ = new BehaviorSubject({
    DEPOSIT: false,
    BRIDGE: false,
    BRIDGE_DEPOSIT: false,
    WITHDRAW: false,
    SWAP_DEPOSIT: false,
    CLAIM_AVALANCHE_BOOST: false,
  });
  stakingProtocolActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    STAKE: false,
    WITHDRAW: false,
    UNSTAKE: false,
  });
  lpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    PROVIDE_LIQUIDITY: false,
    WITHDRAW: false,
    REMOVE_LIQUIDITY: false,
  });
  gmxV2Actions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    PROVIDE_LIQUIDITY: false,
    WITHDRAW: false,
    REMOVE_LIQUIDITY: false,
    PARTNER_PROFILE: false,
  });
  penpieActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    IMPORT_AND_STAKE: false,
    CREATE_LP: false,
    EXPORT_LP: false,
    UNSTAKE_AND_EXPORT: false,
    UNWIND: false,
    CLAIM_REWARDS: false,
  });
  traderJoeLpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    WITHDRAW: false,
    ADD_LIQUIDITY: false,
    REMOVE_LIQUIDITY: false,
    CLAIM_TRADERJOE_REWARDS: false,
  });
  levelLpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    PROVIDE_LIQUIDITY: false,
    WITHDRAW: false,
    REMOVE_LIQUIDITY: false,
    CLAIM_LEVEL_REWARDS: false,
    PARTNER_PROFILE: false,
  });
  balancerLpActions$ = new BehaviorSubject({
    FUND_AND_STAKE: false,
    STAKE: false,
    PROVIDE_LIQUIDITY: false,
    UNSTAKE_AND_WITHDRAW: false,
    WITHDRAW: false,
    REMOVE_LIQUIDITY: false,
    CLAIM_REWARDS: false,
  });
  concentratedLpActions$ = new BehaviorSubject({
    ADD_FROM_WALLET: false,
    PROVIDE_LIQUIDITY: false,
    WITHDRAW: false,
    REMOVE_LIQUIDITY: false,
  });
  zapsActions$ = new BehaviorSubject({
    LONG: false,
    SHORT: false,
    CONVERT_GLP_TO_GM: false,
    CREATE_ACCOUNT: false,
  });
  sprimeActions$ = new BehaviorSubject({
    MINT: false,
    REBALANCE: false,
    REDEEM: false,
    BUY: false,
  });

  actionsSectionsRecord = {
    'ASSETS': this.assetsActions$,
    'POOLS': this.poolsActions$,
    'STAKING_PROTOCOL': this.stakingProtocolActions$,
    'LP': this.lpActions$,
    'GMXV2': this.gmxV2Actions$,
    'PENPIE': this.penpieActions$,
    'TRADER_JOE_LP': this.traderJoeLpActions$,
    'LEVEL_LP': this.levelLpActions$,
    'BALANCER_LP': this.balancerLpActions$,
    'CONCENTRATED_LP': this.concentratedLpActions$,
    'ZAPS': this.zapsActions$,
    'SPRIME': this.sprimeActions$,
  }

  allSectionsSubjects = [
    this.assetsActions$,
    this.poolsActions$,
    this.stakingProtocolActions$,
    this.lpActions$,
    this.gmxV2Actions$,
    this.penpieActions$,
    this.traderJoeLpActions$,
    this.levelLpActions$,
    this.balancerLpActions$,
    this.concentratedLpActions$,
    this.zapsActions$,
    this.sprimeActions$
  ]

  disableActionInSection(section, action) {
    const sectionSubject = this.actionsSectionsRecord[section]
    const newValue = {
      ...sectionSubject.value,
      [action]: true,
    }
    sectionSubject.next({
      ...sectionSubject.value,
      [action]: true,
    })
  }

  enableActionInSection(section, action) {
    const sectionSubject = this.actionsSectionsRecord[section]
    sectionSubject.next({
      ...sectionSubject.value,
      [action]: false,
    })
  }

  toggleActionInSection(section, action) {
    const sectionSubject = this.actionsSectionsRecord[section]
    sectionSubject.next({
      ...sectionSubject.value,
      [action]: !sectionSubject.value[action],
    })
  }

  disableActionGlobally(action) {
    this.allSectionsSubjects.forEach(sectionSubject => {
      sectionSubject.next({
        ...sectionSubject.value,
        [action]: true,
      })
    })
  }

  enableActionGlobally(action) {
    this.allSectionsSubjects.forEach(sectionSubject => {
      sectionSubject.next({
        ...sectionSubject.value,
        [action]: false,
      })
    })
  }

  disableAllActions() {
    this.allSectionsSubjects.forEach(sectionSubject => {
      const newValue = {}
      Object.keys(sectionSubject).forEach(key => {
        newValue[key] = true;
      })
      sectionSubject.next(newValue)
    })
  }

  enableAllActions() {
    this.allSectionsSubjects.forEach(sectionSubject => {
      const newValue = {}
      Object.keys(sectionSubject).forEach(key => {
        newValue[key] = false;
      })
      sectionSubject.next(newValue)
    })
  }

  enableReadonlyMode() {
    this.appInReadonlyMode$.next(true);
  }

  disableReadonlyMode() {
    this.appInReadonlyMode$.next(false);
  }

  getSectionActions$(section) {
    return this.actionsSectionsRecord[section].asObservable().pipe(
      combineLatestWith(this.appInReadonlyMode$.asObservable()),
      map(([actionSectionRecord, appInReadonlyMode]) => {
        if (appInReadonlyMode) {
          const newRecord = {};
          Object.keys(actionSectionRecord).forEach(key => {
            newRecord[key] = true;
          })
          return newRecord;
        } else {
          return actionSectionRecord;
        }
      })
    );
  }

  getReadonlyMode$() {
    return this.appInReadonlyMode$.asObservable();
  }
}
