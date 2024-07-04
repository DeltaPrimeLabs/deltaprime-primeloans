import {BehaviorSubject, Subject} from 'rxjs';
import config from '../config';
import {formatUnits, fromWei} from "../utils/calculate";
import DEPOSIT_REWARDER from '/artifacts/contracts/interfaces/IDepositRewarder.sol/IDepositRewarder.json'
const ethers = require('ethers');

export default class AvalancheBoostService {
  avalancheBoostUnclaimed$ = new BehaviorSubject(null);
  avalancheBoostAprs$ = new BehaviorSubject(null);

  emitRefreshAvalancheBoostData(address) {
    this.updateAvalancheBoostData(address);
  }

  observeAvalancheBoostUnclaimed() {
    return this.avalancheBoostUnclaimed$.asObservable();
  }

  observeAvalancheBoostAprs() {
    return this.avalancheBoostAprs$.asObservable();
  }

  async updateAvalancheBoostData(address) {
    let rewardsConfig = config.AVALANCHE_BOOST_CONFIG;

    Object.keys(rewardsConfig).forEach(
        poolAsset => {
            const rewarderContract = new ethers.Contract(rewardsConfig[poolAsset].depositRewarderAddress, DEPOSIT_REWARDER.abi, provider.getSigner());

            rewarderContract.rewardRate(address).then(
                (rewardRate) => {
                  const rewardToken = rewardsConfig[poolAsset];
                  const rewardTokenDecimals = config.ASSETS_CONFIG[rewardToken].decimals;

                  this.avalancheBoostAprs$.next(formatUnits(rewardRate, rewardTokenDecimals));
                }
            );

          rewarderContract.earned(address).then(
              (earned) => {
                const rewardToken = rewardsConfig[poolAsset];
                const rewardTokenDecimals = config.ASSETS_CONFIG[rewardToken].decimals;

                this.avalancheBoostUnclaimed$.next(formatUnits(earned, rewardTokenDecimals));
              }
          );
        }
    )
  }
};