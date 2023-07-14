import { Subject } from 'rxjs';
import { LiFi } from "@lifi/sdk";
import { formatUnits, parseUnits } from '@/utils/calculate';
import { ethers } from 'ethers';
import axios from 'axios';
import config from '../config';
import { switchChain } from '../utils/blockchain';

export default class LifiService {
  lifi$ = new Subject();

  emitLifi(lifiData) {
    this.lifi$.next(lifiData);
  }

  observeLifi() {
    return this.lifi$.asObservable();
  }

  cachedBalances = {};

  async setupLifi() {
    const lifiConfig = {
      integrator: "deltaprime"
    }

    const lifi = new LiFi(lifiConfig);

    try {
      const [chains, tokens] = await Promise.all([
        axios.get('https://li.quest/v1/chains'),
        axios.get('https://li.quest/v1/tokens')
      ]);

      this.emitLifi({
        lifi,
        chains: chains.data.chains,
        tokens: tokens.data.tokens
      });
    } catch(error) {
      console.log(`lifi - fetching chains and tokens failed. Error: ${error}`);
    }
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

  async fetchTokenBalancesForChain(lifi, address, chainId, tokens, refresh = false) {
    // return cached balances data if already exists
    if (!refresh && chainId in this.cachedBalances && this.cachedBalances[chainId].length == tokens.length) {
      return this.cachedBalances[chainId];
    }

    const balances = await this.getTokenBalancesForChainWithRetry(lifi, address, chainId, tokens);
    this.cachedBalances[chainId] = balances;

    return balances;
  }

  async getBestRoute(lifi, routesRequest, assetDecimals) {
    try {
      const fromAmount = routesRequest.fromAmount.toFixed(assetDecimals);
      const request = {
        ...routesRequest,
        fromAmount: parseUnits(fromAmount, assetDecimals).toString()
      };
      const result = await lifi.getRoutes(request);
      console.log(result.routes);

      return result.routes;
    } catch(error) {
      console.log(`lifi - fetching routes failed. Error: ${error}`);
      return;
    }
  }

  async resumeRoute(lifi, chosenRoute, progressBarService, depositFunc, { targetSymbol, depositNativeToken }) {
    console.log('resuming lifi bridge...');
    const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
    const signer= provider.getSigner();

    const updateRouteHook = (updatedRoute) => {
      // save route state to local storage
      const processes = updatedRoute.steps[0].execution.process;
      const statusInfo = {};

      processes.map(process => {
        if (process.status !== 'DONE' && process.message) {
          statusInfo.message = process.message;

          if (process.substatusMessage) {
            statusInfo.message = ` ${process.substatusMessage}`;
          }

          if (process.type === 'TOKEN_ALLOWANCE' || process.type === 'CROSS_CHAIN') {
            statusInfo.txLink = process.txLink;
          }
        }
      })

      progressBarService.emitProgressBarInProgressState(statusInfo);
      localStorage.setItem('active-bridge-deposit', JSON.stringify({
        route: updatedRoute,
        targetSymbol,
        depositNativeToken
      }));
      console.log('Route updated', updatedRoute);
    }

    const switchChainHook = async (requiredChainId) => {
      if (!signer) {
        return signer;
      }

      const currentChainId = await signer.getChainId();
  
      if (currentChainId !== requiredChainId) {
        const ethereum = window.ethereum;
        if (typeof ethereum === 'undefined') return;

        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + requiredChainId.toString(16) }],
        });

        const newProvider = new ethers.providers.Web3Provider(window.ethereum, 'any');

        return newProvider.getSigner();
      }
    }

    const updateGasConfig = async (txRequest) => {
      return txRequest;
    }

    const acceptExchangeRateUpdate = async (params) => {
      return params;
    }

    progressBarService.requestProgressBar(chosenRoute.steps[0].estimate.executionDuration);

    const route = await lifi.resumeRoute(signer, chosenRoute, {
      updateRouteHook,
      switchChainHook,
      updateTransactionRequestHook: updateGasConfig,
      acceptExchangeRateUpdateHook: acceptExchangeRateUpdate
    });

    localStorage.setItem('active-bridge-deposit', '');
    progressBarService.emitProgressBarSuccessState();
    await switchChain(config.chainId, signer);

    if (!route.steps || route.steps.length === 0) {
      console.log("something wrong with bridge.");
      return;
    }

    const bridgeExecution = route.steps[0].execution;
    const depositAmount = formatUnits(bridgeExecution.toAmount, bridgeExecution.toToken.decimals);
    const depositRequest = {
      assetSymbol: targetSymbol,
      amount: depositAmount,
      depositNativeToken: depositNativeToken
    };

    await depositFunc({ depositRequest: depositRequest });

    return {
      amount: depositAmount
    };
  }

  removeRoute(lifi, activeRoute) {
    lifi.stopExecution(activeRoute);
  }

  async bridgeAndDeposit({
    bridgeRequest: {
      lifi,
      chosenRoute,
      depositNativeToken,
      signer,
      depositFunc,
      targetSymbol
    },
    progressBarService
  }) {

    const updateRouteHook = (updatedRoute) => {
      // save route state to local storage
      const processes = updatedRoute.steps[0].execution.process;
      const statusInfo = {};

      processes.map(process => {
        if (process.status !== 'DONE' && process.message) {
          statusInfo.message = process.message;

          if (process.substatusMessage) {
            statusInfo.message = ` ${process.substatusMessage}`;
          }

          if (process.type === 'TOKEN_ALLOWANCE' || process.type === 'CROSS_CHAIN') {
            statusInfo.txLink = process.txLink;
          }
        }
      })

      progressBarService.emitProgressBarInProgressState(statusInfo);
      localStorage.setItem('active-bridge-deposit', JSON.stringify({
        route: updatedRoute,
        targetSymbol,
        depositNativeToken
      }));
      console.log('Route updated', updatedRoute);
    }

    const switchChainHook = async (requiredChainId) => {
      if (!signer) {
        return signer;
      }

      const currentChainId = await signer.getChainId();
  
      if (currentChainId !== requiredChainId) {
        const ethereum = window.ethereum;
        if (typeof ethereum === 'undefined') return;

        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + requiredChainId.toString(16) }],
        });

        const newProvider = new ethers.providers.Web3Provider(window.ethereum, 'any');

        return newProvider.getSigner();
      }
    }

    const updateGasConfig = async (txRequest) => {
      return txRequest;
    }

    const acceptExchangeRateUpdate = async (params) => {
      return params;
    }

    progressBarService.requestProgressBar(chosenRoute.steps[0].estimate.executionDuration);

    const route = await lifi.executeRoute(signer, chosenRoute, {
      updateRouteHook,
      switchChainHook,
      updateTransactionRequestHook: updateGasConfig,
      acceptExchangeRateUpdateHook: acceptExchangeRateUpdate
    });
    console.log('bridge transactions completed.');

    localStorage.setItem('active-bridge-deposit', '');
    progressBarService.emitProgressBarSuccessState();
    await switchChain(config.chainId, signer);

    if (!route.steps || route.steps.length === 0) {
      console.log("something wrong with bridge.");
      return;
    }

    const bridgeExecution = route.steps[0].execution;
    const depositAmount = formatUnits(bridgeExecution.toAmount, bridgeExecution.toToken.decimals);
    const depositRequest = {
      assetSymbol: targetSymbol,
      amount: depositAmount,
      depositNativeToken: depositNativeToken
    };

    await depositFunc({ depositRequest: depositRequest });

    return {
      amount: depositAmount
    };
  }
}