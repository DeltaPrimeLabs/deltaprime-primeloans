import {BehaviorSubject} from 'rxjs';
import {fromWei} from "../utils/calculate";
import vPRIME from '@artifacts/contracts/token/vPrime.sol/vPrime.json';
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

  async updateVPrimeData(vPrimeAddress, ownerAddress) {
      const vPrimeContract = new ethers.Contract(vPrimeAddress, vPRIME.abi, provider.getSigner());

      vPrimeContract.balanceOf(ownerAddress).then(
          points => {
              this.vPrimePoints$.next(fromWei(points));
      });
  }
};