import {BehaviorSubject} from 'rxjs';
import {fromWei} from "../utils/calculate";
import vPRIME from '@artifacts/contracts/interfaces/IVPrime.sol/IVPrime.json';
const ethers = require('ethers');

export default class vPrimeService {
  vPrimePoints$ = new BehaviorSubject(null);
  vPrimeRate$ = new BehaviorSubject(null);

  emitRefreshVPrimeData(vPrimeAddress, ownerAddress) {
    this.updateVPrimeData(vPrimeAddress, ownerAddress);
  }

  observeVPrimePoints() {
    return this.vPrimePoints$.asObservable();
  }

    observeVPrimeRate() {
        return this.vPrimeRate$.asObservable();
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
                          this.vPrimeRate$.next(fromWei(checkpoint.rate));
                      });
              }
          });
  }
};