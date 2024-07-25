import {BehaviorSubject} from 'rxjs';
import config from '../config';
import {fromWei} from '../utils/calculate';
import vPRIME from '@artifacts/contracts/interfaces/IVPrime.sol/IVPrime.json';

const ethers = require('ethers');

export default class vPrimeService {
  vPrimePoints$ = new BehaviorSubject(null);
  vPrimeRate$ = new BehaviorSubject(null);
  vPrimeBalanceLimit$ = new BehaviorSubject(null);

  emitRefreshVPrimeDataWithDefault(ownerAddress) {
    this.updateVPrimeData(config.VPRIME_CONFIG.address, ownerAddress);
  }

  emitRefreshVPrimeData(vPrimeAddress, ownerAddress) {
    this.updateVPrimeData(vPrimeAddress, ownerAddress);
  }

  observeVPrimePoints() {
    return this.vPrimePoints$.asObservable();
  }

  observeVPrimeRate() {
    return this.vPrimeRate$.asObservable();
  }

  observeVPrimeBalanceLimit() {
    return this.vPrimeBalanceLimit$.asObservable();
  }

  async updateVPrimeData(vPrimeAddress, ownerAddress) {
    const vPrimeContract = new ethers.Contract(vPrimeAddress, vPRIME.abi, provider.getSigner());

    vPrimeContract.balanceOf(ownerAddress).then(
      points => {
        this.vPrimePoints$.next(fromWei(points));
      });

    vPrimeContract.numCheckpoints(ownerAddress).then(
      num => {
        if (!num) {
          this.vPrimeRate$.next(0);
        } else {
          vPrimeContract.checkpoints(ownerAddress, num - 1).then(
            checkpoint => {
              // checkpoint.balanceLimit
              console.log('checkpoint.balanceLimit');
              const balanceLimit = fromWei(checkpoint.balanceLimit);
              console.log('balanceLimit', balanceLimit);
              const yearlyRate = checkpoint.rate.toNumber() * 3600 * 24 / 1e18;
              this.vPrimeBalanceLimit$.next(balanceLimit);
              this.vPrimeRate$.next(yearlyRate);
            });
        }
      });
  }
};