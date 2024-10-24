import {Subject} from 'rxjs';
import EthereumProvider from '@walletconnect/ethereum-provider';
const ethers = require('ethers');
import config from '../config';

export default class ProviderService {

  provider$ = new Subject();
  providerCreated$ = new Subject();
  historicalProvider$ = new Subject();

  accountService;

  constructor(accountService) {
    this.accountService = accountService;
  }

  initNetwork() {
    this.initProvider();

  }

  emitProviderCreated(provider) {
    this.providerCreated$.next(provider);
  }

  async initProvider() {
    const provider = await EthereumProvider.init({
      projectId: 'b37251de649ba5a253d413f7558327cd',
      metadata: {
        name: 'My Website',
        description: 'My Website Description',
        url: 'https://mywebsite.com', // origin must match your domain & subdomain
        icons: ['https://avatars.githubusercontent.com/u/37784886']
      },
      rpcMap: {
        43114: config.readRpcUrl,
        42161: 'https://api.avax.network/ext/bc/C/rpc',
      },
      showQrModal: true,
      optionalChains: [43114, 42161],

    })

    console.log(provider)

    await provider.connect()

    const account = await provider.request({ method: 'eth_requestAccounts' })
    console.log(account)
    window.ownAccount = account[0];

    this.accountService.emitAccount(account[0]);

    const ethersProvider = new ethers.providers.Web3Provider(provider);

    this.emitProvider(ethersProvider);

    const historicalProvider = new ethers.providers.JsonRpcProvider(config.historicalRpcUrl);
    this.emitHistoricalProvider(historicalProvider);
  }

  observeProvider() {
    return this.provider$.asObservable();
  }

  observeHistoricalProvider() {
    return this.historicalProvider$.asObservable();
  }

  emitProvider(provider) {
    console.log('--___--___--__--___--___--____---____-EMITTING PROVIDER-------___---___--__--__--___--', provider);
    this.provider$.next(provider);
  }

  emitHistoricalProvider(provider) {
    this.historicalProvider$.next(provider);
  }
};