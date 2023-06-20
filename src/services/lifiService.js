import { Subject } from 'rxjs';
import { LiFi } from "@lifi/sdk";
import { parseUnits } from '@/utils/calculate';
import { ethers } from 'ethers';
import axios from 'axios';

export default class LifiService {
  lifi$ = new Subject();

  emitLifi(lifiData) {
    this.lifi$.next(lifiData);
  }

  observeLifi() {
    return this.lifi$.asObservable();
  }

  async setupLifi() {
    const lifiConfig = {
      integrator: "deltaprime"
    }

    const lifi = new LiFi(lifiConfig);

    const [chains, tokens] = await Promise.all([
      axios.get('https://li.quest/v1/chains'),
      axios.get('https://li.quest/v1/tokens')
    ]);

    this.emitLifi({
      lifi,
      chains: chains.data.chains,
      tokens: tokens.data.tokens
    });
  }

  async getTokenBalancesForChainWithRetry(lifi, address, chainId, tokens, depth = 0) {
    try {
      const tokenBalances = await lifi.getTokenBalancesForChains(
        address,
        { [chainId]: tokens }
      );

      if (!Array.from(tokenBalances).every((token) => token.blockNumber)) {
        if (depth > 10) {
          console.warn('Token balance backoff depth exceeded.');
          return undefined;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 1.5 ** depth * 100);
        });

        return this.getTokenBalancesForChainWithRetry(lifi, address, chainId, tokens, depth + 1);
      }

      return tokenBalances[chainId];;
    }
    catch (error) {
      console.log(`fetching token balances failed. ${chainId}. Error: ${error}`);
    }
  };

  async fetchTokenBalancesForChain(lifi, address, chainId, tokens) {
    // return cached balances data if already exists
    // if (chainId in this.cachedBalances && this.cachedBalances[chainId].length == tokens.length) {
    //   return this.cachedBalances[chainId];
    // }

    const balances = await this.getTokenBalancesForChainWithRetry(lifi, address, chainId, tokens);
    return balances;
  }

  async getBestRoute(lifi, routesRequest, assetDecimals) {
    const fromAmount = routesRequest.fromAmount.toFixed(assetDecimals);
    const request = {
      ...routesRequest,
      fromAmount: parseUnits(fromAmount, assetDecimals).toString()
    };
    console.log(request);

    const result = await lifi.getRoutes(request);
    const routes = result.routes;

    return routes.length > 0 ? routes[0] : null;
  }

  async bridgeAndDeposit({ bridgeRequest: { lifi, chosenRoute, signer } }) {
    const switchChainHook = async (requiredChainId) => {
      // this is where MetaMask lives
      const ethereum = window.ethereum
  
      // check if MetaMask is available
      if (typeof ethereum === 'undefined') return
  
      // use the MetaMask RPC API to switch chains automatically
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + requiredChainId.toString(16) }],
      })
  
      // build a new provider for the new chain
      const newProvider = new ethers.providers.Web3Provider(window.ethereum)
  
      // return the associated Signer
      return newProvider.getSigner()
    }

    const route = await lifi.executeRoute(signer, chosenRoute, {switchChainHook});
    console.log(route);
  }
}