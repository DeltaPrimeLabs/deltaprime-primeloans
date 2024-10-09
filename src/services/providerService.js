import {Subject} from 'rxjs';

export default class ProviderService {

  providerCreated$ = new Subject();

  observeProviderCreated() {
    return this.providerCreated$.asObservable();
  }

  emitProviderCreated(provider) {
    this.providerCreated$.next(provider);
  }
};