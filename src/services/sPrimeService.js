import {BehaviorSubject, Subject} from 'rxjs';
import config from '../config';
import {wrapContract} from "../utils/blockchain";
import {fromWei} from "../utils/calculate";
import SPRIME from '@artifacts/contracts/token/sPrime.sol/sPrime.json';
const ethers = require('ethers');

export default class sPrimeService {
  sPrimeValue$ = new BehaviorSubject(null);

  emitRefreshSPrimeData(provider, sPrimeAddress, dex, secondAsset, ownerAddress) {
    this.updateSPrimeData(provider, sPrimeAddress, dex, secondAsset, ownerAddress);
  }

  observeSPrimeValue() {
    return this.sPrimeValue$.asObservable();
  }

  async updateSPrimeData(provider, sPrimeAddress, dex, secondAsset, ownerAddress) {
      let dataFeeds = [...Object.keys(config.POOLS_CONFIG), secondAsset];

      const sPrimeContract = await wrapContract(new ethers.Contract(sPrimeAddress, SPRIME.abi, provider.getSigner()), dataFeeds);

      sPrimeContract.getPoolPrice().then(
          poolPrice => {
              sPrimeContract.getUserValueInTokenY(ownerAddress, poolPrice).then(
                  res => res.json().then(
                      value => {
                          this.sPrimeValue$.next(fromWei(value))
                      }
                  )
              );
          }
      )
  }
};