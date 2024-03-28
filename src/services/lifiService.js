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
      return {
        error: true,
        message: error.message
      };
    }
  }

  getStatusInfo(route) {
    const statusInfo = {};
    route.steps.map((step) => {
      if (!step.execution) return;
      const processes = step.execution.process;

      processes.map(process => {
        if (process.status === 'DONE' || process.status === 'FAILED') return;

        if (process.message) {
          statusInfo.message = process.message;

          if (process.substatusMessage) {
            statusInfo.message = ` ${process.substatusMessage}`;
          }

          if (process.type === 'TOKEN_ALLOWANCE' || process.type === 'CROSS_CHAIN') {
            statusInfo.txLink = process.txLink;
          }
        } else if (process.type === 'SWITCH_CHAIN') {
          statusInfo.message = 'Switching chain.';
        } else if (process.error) {
          statusInfo.message = process.error.htmlMessage;
        }
      })
    });

    return statusInfo;
  }

  getEstimatedDuration(route) {
    let duration = 0;
    route.steps.map((step) => duration += step.estimate.executionDuration);

    return duration;
  }

  removeRoute(lifi, activeRoute) {
    // remove transfer status for wallet address(equal to from address) from local storage
    const history = JSON.parse(localStorage.getItem('active-bridge-deposit'));
    delete history[activeRoute.fromAddress.toLowerCase()];
    localStorage.setItem('active-bridge-deposit', JSON.stringify(history));
    lifi.stopExecution(activeRoute);
  }

  bridgeAndDeposit = async ({
    bridgeRequest: {
      lifi,
      chosenRoute,
      depositNativeToken,
      signer,
      depositFunc,
      targetSymbol,
      disableDeposit
    },
    progressBarService,
    resume
  }) => {

    const updateRouteHook = (updatedRoute) => {
      // save route state to local storage for different wallet address
      if (!updatedRoute) return;

      const statusInfo = this.getStatusInfo(updatedRoute);
      progressBarService.emitProgressBarInProgressState(statusInfo);

      const history = JSON.parse(localStorage.getItem('active-bridge-deposit'));
      const updatedHistory = {
        ...history,
        [updatedRoute.fromAddress.toLowerCase()]: {
          route: updatedRoute,
          targetSymbol,
          depositNativeToken,
          disableDeposit
        }
      }
      localStorage.setItem('active-bridge-deposit', JSON.stringify(updatedHistory));
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

    const estimatedDuration = this.getEstimatedDuration(chosenRoute);
    progressBarService.requestProgressBar(estimatedDuration);

    const routeOptions = {
      updateRouteHook,
      switchChainHook,
      updateTransactionRequestHook: updateGasConfig,
      acceptExchangeRateUpdateHook: acceptExchangeRateUpdate
    };
    let route;

    if (!resume) {
      route = await lifi.resumeRoute(signer, chosenRoute, routeOptions);
    } else {
      route = await lifi.executeRoute(signer, chosenRoute, routeOptions);
    }
    console.log('bridge transactions completed.');

    const processes = route.steps[route.steps.length - 1].execution.process;
    const lastStep = processes[processes.length - 1];
    const statusInfo = {};

    if (lastStep.status === 'DONE') {
      statusInfo.message = lastStep.message;
      if (lastStep.txLink) statusInfo.txLink = lastStep.txLink;
    }

    progressBarService.emitProgressBarInProgressState(statusInfo);
    await switchChain(route.toChainId, signer);

    if (!route.steps || route.steps.length === 0) {
      console.log("something wrong with bridge.");
      return;
    }

    // if bridge only without deposit, don't execute deposit and return here
    if (disableDeposit) {
      const history = JSON.parse(localStorage.getItem('active-bridge-deposit'));
      delete history[route.fromAddress.toLowerCase()];
      localStorage.setItem('active-bridge-deposit', JSON.stringify(history));
      return;
    }

    const bridgeExecution = route.steps[route.steps.length - 1].execution;
    const depositAmount = formatUnits(bridgeExecution.toAmount, bridgeExecution.toToken.decimals);
    const depositRequest = {
      assetSymbol: targetSymbol,
      amount: depositAmount,
      depositNativeToken: depositNativeToken
    };

    await depositFunc({ depositRequest: depositRequest });
    const history = JSON.parse(localStorage.getItem('active-bridge-deposit'));
    delete history[route.fromAddress.toLowerCase()];
    localStorage.setItem('active-bridge-deposit', JSON.stringify(history));

    return {
      amount: depositAmount
    };
  }
}