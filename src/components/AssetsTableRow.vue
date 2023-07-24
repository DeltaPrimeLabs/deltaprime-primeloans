<template>
  <div class="fund-table-row-component" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="asset">
      <div class="table__cell asset">
        <img class="asset__icon" :src="getAssetIcon(asset.symbol)">
        <div class="asset__info">
          <div class="asset__name">{{ asset.symbol }}</div>
          <div class="asset__loan" v-if="borrowApyPerPool && borrowApyPerPool[asset.symbol] !== undefined">
            Borrow&nbsp;APY:&nbsp;{{ borrowApyPerPool[asset.symbol] | percent }}
          </div>
          <div class="asset__loan" v-if="asset.apy">
            Profit APY:&nbsp;{{ asset.apy / 100 | percent }}
          </div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value balance">
        <template
            v-if="assetBalances !== null && assetBalances !== undefined && parseFloat(assetBalances[asset.symbol])">
          <div class="double-value__pieces">
            <span v-if="isBalanceEstimated">~</span>{{ assetBalances[asset.symbol] | smartRound }}
          </div>
          <div class="double-value__usd">
            <span v-if="assetBalances[asset.symbol]">{{ assetBalances[asset.symbol] * asset.price | usd }}</span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value farmed">
        <template
            v-if="totalStaked">
          <div class="double-value__pieces">
            {{ totalStaked | smartRound }}
          </div>
          <div class="double-value__usd">
            <span v-if="totalStaked">{{ totalStaked * asset.price | usd }}</span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value loan">
        <template v-if="debtsPerAsset && debtsPerAsset[asset.symbol] && parseFloat(debtsPerAsset[asset.symbol].debt)">
          <div class="double-value__pieces">
            <span v-if="isDebtEstimated">~</span>{{ debtsPerAsset[asset.symbol].debt | smartRound(8, true) }}
          </div>
          <div class="double-value__usd">{{ debtsPerAsset[asset.symbol].debt * asset.price | usd }}</div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell impact">
        <span>{{ Math.round((1 / (1 - asset.debtCoverage) - 1)) }}x</span>
      </div>

      <div class="table__cell trend">
        <div class="trend__chart-change" v-on:click="toggleChart()">
          <SmallChartBeta :data-points="asset.prices"
                          :is-stable-coin="asset.isStableCoin"
                          :line-width="2"
                          :width="60"
                          :height="25"
                          :positive-change="todayPriceChange > 0">
          </SmallChartBeta>
          <ColoredValueBeta v-if="todayPriceChange" :value="todayPriceChange" :formatting="'percent'"
                            :percentage-rounding-precision="2" :show-sign="true"></ColoredValueBeta>
        </div>
      </div>

      <div class="table__cell price">
        {{ asset.price | usd }}
      </div>

      <div></div>

      <div class="table__cell actions">
        <IconButton class="action-button"
                    :disabled="(disableAllButtons || !healthLoaded) && (!(asset.debtCoverage > 0 && noSmartLoan))"
                    :icon-src="'src/assets/icons/plus.svg'" :size="26"
                    v-tooltip="{content: 'Deposit collateral', classes: 'button-tooltip'}"
                    v-on:click="actionClick('ADD_FROM_WALLET')">
          <template v-if="(asset.symbol === 'AVAX' && noSmartLoan)" v-slot:bubble>
            To create your Prime Account, click on the
            <DeltaIcon class="icon-button__icon" :icon-src="'src/assets/icons/plus-white.svg'"
                       :size="26"
            ></DeltaIcon>
            button, and then click &quot;Deposit collateral&quot;
          </template>
        </IconButton>
        <IconButton :disabled="disableAllButtons || !healthLoaded"
                    class="action-button"
                    :icon-src="'src/assets/icons/swap.svg'" :size="26"
                    v-tooltip="{content: 'Swap', classes: 'button-tooltip'}"
                    v-on:click="actionClick('SWAP')">
        </IconButton>
        <IconButtonMenuBeta
            class="actions__icon-button"
            :config="moreActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="disableAllButtons || !healthLoaded">
        </IconButtonMenuBeta>
      </div>
    </div>

    <div class="chart-container" v-if="showChart">
      <SmallBlock v-on:close="toggleChart()">
        <Chart :data-points="asset.prices"
               :line-width="3"
               :min-y="asset.minPrice"
               :max-y="asset.maxPrice"
               :positive-change="todayPriceChange > 0">
        </Chart>
      </SmallBlock>
    </div>

  </div>
</template>

<script>
import SmallChartBeta from './SmallChartBeta';
import ColoredValueBeta from './ColoredValueBeta';
import IconButtonMenuBeta from './IconButtonMenuBeta';
import Chart from './Chart';
import SmallBlock from './SmallBlock';
import LoadedValue from './LoadedValue';
import config from '../config';
import {mapActions, mapState} from 'vuex';
import BorrowModal from './BorrowModal';
import SwapModal from './SwapModal';
import AddFromWalletModal from './AddFromWalletModal';
import WithdrawModal from './WithdrawModal';
import RepayModal from './RepayModal';
import addresses from '../../common/addresses/avax/token_addresses.json';
import erc20ABI from '../../test/abis/ERC20.json';
import WrapModal from './WrapModal';
import YAK_ROUTER_ABI
  from '../../test/abis/YakRouter.json';
import YAK_WRAP_ROUTER
  from '../../artifacts/contracts/interfaces/IYakWrapRouter.sol/IYakWrapRouter.json';
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import {formatUnits, parseUnits} from '../utils/calculate';
import GLP_REWARD_ROUTER
  from '../../artifacts/contracts/interfaces/facets/avalanche/IRewardRouterV2.sol/IRewardRouterV2.json';
import GLP_REWARD_TRACKER
  from '../../artifacts/contracts/interfaces/facets/avalanche/IRewardTracker.sol/IRewardTracker.json';
import ClaimGLPRewardsModal from './ClaimGLPRewardsModal';
import {BigNumber} from 'ethers';
import DeltaIcon from './DeltaIcon.vue';
import IconButton from './IconButton.vue';
import {constructSimpleSDK, SwapSide} from '@paraswap/sdk';
import axios from 'axios';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const BORROWABLE_ASSETS = ['AVAX', 'USDC', 'USDT', 'BTC', 'ETH'];

const ethers = require('ethers');


export default {
  name: 'AssetsTableRow',
  components: {
    IconButton,
    DeltaIcon, LoadedValue, SmallBlock, Chart, IconButtonMenuBeta, ColoredValueBeta, SmallChartBeta
  },
  props: {
    asset: {},
  },
  mounted() {
    this.setupAvailableFarms();
    this.setupActionsConfiguration();
    this.watchExternalAssetBalanceUpdate();
    this.watchExternalAssetDebtUpdate();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchDebtsPerAssetDataRefreshEvent();
    this.watchHardRefreshScheduledEvent();
    this.watchHealth();
    this.watchAssetApysRefreshScheduledEvent();
    this.watchProgressBarState();
    this.setupPoolsApy();
    this.watchExternalTotalStakedUpdate();
    this.watchFarmRefreshEvent();
  },
  data() {
    return {
      moreActionsConfig: null,
      showChart: false,
      rowExpanded: false,
      isBalanceEstimated: false,
      isDebtEstimated: false,
      disableAllButtons: false,
      borrowApyPerPool: {},
      healthLoaded: false,
      totalStaked: null,
      availableFarms: [],
    };
  },
  computed: {
    ...mapState('fundsStore', [
      'smartLoanContract',
      'health',
      'assetBalances',
      'fullLoanStatus',
      'debtsPerAsset',
      'assets',
      'lpAssets',
      'concentratedLpAssets',
      'lpBalances',
      'concentratedLpBalances',
      'noSmartLoan'
    ]),
    ...mapState('stakeStore', ['farms']),
    ...mapState('poolStore', ['pools']),
    ...mapState('network', ['provider', 'account', 'accountBalance']),
    ...mapState('serviceRegistry', [
      'assetBalancesExternalUpdateService',
      'dataRefreshEventService',
      'progressBarService',
      'assetDebtsExternalUpdateService',
      'poolService',
      'healthService',
      'stakedExternalUpdateService',
      'farmService',
    ]),

    loanValue() {
      return this.formatTokenBalance(this.debt);
    },

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },

    todayPriceChange() {
      return this.asset.prices && (this.asset.prices[this.asset.prices.length - 1].y - this.asset.prices[0].y) / this.asset.prices[this.asset.prices.length - 1].y;
    }
  },
  methods: {
    ...mapActions('fundsStore',
      [
        'swap',
        'paraSwap',
        'swapDebt',
        'fund',
        'borrow',
        'withdraw',
        'withdrawNativeToken',
        'repay',
        'createAndFundLoan',
        'createLoanAndDeposit',
        'fundNativeToken',
        'wrapNativeToken',
        'mintAndStakeGlp',
        'unstakeAndRedeemGlp',
        'claimGLPRewards'
      ]),
    ...mapActions('network', ['updateBalance']),
    setupActionsConfiguration() {
      this.moreActionsConfig = {
        iconSrc: 'src/assets/icons/icon_a_more.svg',
        tooltip: 'More',
        menuOptions: [
          ...(BORROWABLE_ASSETS.includes(this.asset.symbol) ?
            [
              {
                key: 'BORROW',
                name: 'Borrow',
                disabled: this.borrowDisabled(),
                disabledInfo: 'To borrow, you need to add some funds from you wallet first'
              },
              {
                key: 'REPAY',
                name: 'Repay',
              },
              {
                key: 'SWAP_DEBT',
                name: 'Swap debt',
              }
            ]
            : []),
          this.asset.symbol === 'AVAX' ? {
            key: 'WRAP',
            name: 'Wrap native AVAX',
            hidden: true,
          } : null,
          this.asset.symbol === 'GLP' ? {
            disabled: !this.hasSmartLoanContract,
            key: 'CLAIM_GLP_REWARDS',
            name: 'Claim GLP rewards',
          } : null,
          {
            key: 'WITHDRAW',
            name: 'Withdraw collateral',
          },
        ]
      };
    },

    toggleChart() {
      if (this.rowExpanded) {
        this.showChart = false;
        this.rowExpanded = false;
      } else {
        this.rowExpanded = true;
        setTimeout(() => {
          this.showChart = true;
        }, 200);
      }
    },

    formatTokenBalance(balance) {
      const balanceOrderOfMagnitudeExponent = String(balance).split('.')[0].length - 1;
      const precisionMultiplierExponent = 5 - balanceOrderOfMagnitudeExponent;
      const precisionMultiplier = Math.pow(10, precisionMultiplierExponent >= 0 ? precisionMultiplierExponent : 0);
      return balance !== null ? String(Math.round(balance * precisionMultiplier) / precisionMultiplier) : '';
    },

    yakSwapQueryMethod() {
      return async (sourceAsset, targetAsset, amountIn) => {
        const tknFrom = TOKEN_ADDRESSES[sourceAsset];
        const tknTo = TOKEN_ADDRESSES[targetAsset];

        if (sourceAsset !== 'GLP' && targetAsset !== 'GLP') {
          const yakRouter = new ethers.Contract(config.yakRouterAddress, YAK_ROUTER_ABI, provider.getSigner());

          const maxHops = 3;
          const gasPrice = ethers.utils.parseUnits('225', 'gwei');

          try {
            return await yakRouter.findBestPathWithGas(
              amountIn,
              tknFrom,
              tknTo,
              maxHops,
              gasPrice,
              {gasLimit: 1e9}
            );
          } catch (e) {
            this.handleTransactionError(e);
          }
        } else {
          const yakWrapRouter = new ethers.Contract(config.yakWrapRouterAddress, YAK_WRAP_ROUTER.abi, provider.getSigner());

          // const maxHops = sourceAsset === 'GLP' ? 1 : 2;
          const maxHops = 3;
          const gasPrice = ethers.utils.parseUnits('225', 'gwei');

          if (targetAsset === 'GLP') {
            try {
              return await yakWrapRouter.findBestPathAndWrap(
                amountIn,
                tknFrom,
                config.yieldYakGlpWrapperAddress,
                maxHops,
                gasPrice);
            } catch (e) {
              this.handleTransactionError(e);
            }
          } else {
            try {
              return await yakWrapRouter.unwrapAndFindBestPath(
                amountIn,
                tknTo,
                config.yieldYakGlpWrapperAddress,
                maxHops,
                gasPrice);
            } catch (e) {
              this.handleTransactionError(e);
            }
          }
        }
      };
    },

    paraSwapQueryMethod() {
      return async (sourceAsset, targetAsset, amountIn) => {
        console.warn('PARA SWAP QUERY METHOD');
        const paraSwapSDK = constructSimpleSDK({chainId: config.chainId, axios});

        console.log('sourceAsset', sourceAsset);
        console.log('targetAsset', targetAsset);
        console.log('srcToken', TOKEN_ADDRESSES[sourceAsset]);
        console.log('destToken', TOKEN_ADDRESSES[targetAsset]);
        console.log('amount', amountIn);
        console.log('userAddress', this.smartLoanContract.address);
        console.log('side', SwapSide.SELL);

        const swapRate = await paraSwapSDK.swap.getRate({
          srcToken: TOKEN_ADDRESSES[sourceAsset],
          srcDecimals: config.ASSETS_CONFIG[sourceAsset].decimals,
          destToken: TOKEN_ADDRESSES[targetAsset],
          destDecimals: config.ASSETS_CONFIG[targetAsset].decimals,
          amount: amountIn,
          userAddress: this.smartLoanContract.address,
          side: SwapSide.SELL,
        });
        console.log('priceRoute');
        console.log(swapRate);

        const sourceAmountWei = parseUnits(Number(`${swapRate.srcAmount}e-${swapRate.srcDecimals}`).toFixed(swapRate.srcDecimals), swapRate.srcDecimals);
        const targetAmountWei = parseUnits(Number(`${swapRate.destAmount}e-${swapRate.destDecimals}`).toFixed(swapRate.destDecimals), swapRate.destDecimals);

        const queryResponse = {
          amounts: [sourceAmountWei, targetAmountWei],
          dex: 'PARA_SWAP',
          swapRate: swapRate
        };

        console.log('queryResponse', queryResponse);
        return queryResponse;
      };
    },

    swapDebtQueryMethod() {
      return async (sourceAsset, targetAsset, amountIn) => {
        const tknFrom = TOKEN_ADDRESSES[sourceAsset];
        const tknTo = TOKEN_ADDRESSES[targetAsset];

        if (sourceAsset !== 'GLP' && targetAsset !== 'GLP') {
          const yakRouter = new ethers.Contract(config.yakRouterAddress, YAK_ROUTER_ABI, provider.getSigner());

          const maxHops = 1;
          const gasPrice = ethers.utils.parseUnits('225', 'gwei');

          try {
            return await yakRouter.findBestPathWithGas(
              amountIn,
              tknFrom,
              tknTo,
              maxHops,
              gasPrice,
              {gasLimit: 1e9}
            );
          } catch (e) {
            this.handleTransactionError(e);
          }
        } else {
          const yakWrapRouter = new ethers.Contract(config.yakWrapRouterAddress, YAK_WRAP_ROUTER.abi, provider.getSigner());

          const maxHops = 1;
          const gasPrice = ethers.utils.parseUnits('225', 'gwei');

          if (targetAsset === 'GLP') {
            try {
              return await yakWrapRouter.findBestPathAndWrap(
                amountIn,
                tknFrom,
                config.yieldYakGlpWrapperAddress,
                maxHops,
                gasPrice);
            } catch (e) {
              this.handleTransactionError(e);
            }
          } else {
            try {
              return await yakWrapRouter.unwrapAndFindBestPath(
                amountIn,
                tknTo,
                config.yieldYakGlpWrapperAddress,
                maxHops,
                gasPrice);
            } catch (e) {
              this.handleTransactionError(e);
            }
          }
        }
      };
    },

    actionClick(key) {
      if (!this.disableAllButtons && this.healthLoaded || (this.noSmartLoan && this.asset.debtCoverage > 0 && key === 'ADD_FROM_WALLET')) {
        switch (key) {
          case 'BORROW':
            this.openBorrowModal();
            break;
          case 'ADD_FROM_WALLET':
            this.openAddFromWalletModal();
            break;
          case 'BRIDGE_COLLATERAL':
            this.openBridgeModal();
            break;
          case 'WITHDRAW':
            this.openWithdrawModal();
            break;
          case 'REPAY':
            this.openRepayModal();
            break;
          case 'SWAP':
            this.openSwapModal();
            break;
          case 'SWAP_DEBT':
            this.openDebtSwapModal();
            break;
          case 'WRAP':
            this.openWrapModal();
            break;
          case 'CLAIM_GLP_REWARDS':
            this.claimGLPRewardsAction();
            break;
        }
      }
    },

    borrowDisabled() {
      if (!this.pools) {
        return true;
      }
      if (!this.hasSmartLoanContract) {
        return true;
      }
      return false;
    },

    openBorrowModal() {
      this.progressBarService.progressBarState$.next('SUCCESS');
      const pool = this.pools.find(pool => pool.asset.symbol === this.asset.symbol);
      const modalInstance = this.openModal(BorrowModal);
      modalInstance.asset = this.asset;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.assetBalance = Number(this.assetBalances[this.asset.symbol]);
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue;
      modalInstance.availableInPool = Number(pool.tvl) - Number(pool.totalBorrowed);
      modalInstance.poolTVL = Number(pool.tvl);
      modalInstance.totalBorrowedFromPool = Number(pool.totalBorrowed);
      modalInstance.loanAPY = pool.borrowingAPY;
      modalInstance.maxUtilisation = pool.maxUtilisation;
      modalInstance.$on('BORROW', value => {
        const borrowRequest = {
          asset: this.asset.symbol,
          amount: value.toString()
        };
        this.handleTransaction(this.borrow, {borrowRequest: borrowRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        })
          .then(() => {
          });
      });
    },

    openSwapModal() {
      const swapDexSwapMethodMap = {
        YakSwap: this.swap,
        ParaSwap: this.paraSwap
      };
      console.log(this.assetBalances);
      const modalInstance = this.openModal(SwapModal);
      modalInstance.swapDebtMode = false;
      modalInstance.sourceAsset = this.asset.symbol;
      modalInstance.sourceAssetBalance = this.assetBalances[this.asset.symbol];
      modalInstance.assets = this.assets;
      modalInstance.sourceAssets = config.AVAILABLE_ASSETS_PER_DEX;
      modalInstance.targetAssets = config.AVAILABLE_ASSETS_PER_DEX;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = Object.keys(config.ASSETS_CONFIG).filter(asset => asset !== this.asset.symbol)[0];
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.queryMethods = {
        YakSwap: this.yakSwapQueryMethod(),
        ParaSwap: this.paraSwapQueryMethod()
      };
      modalInstance.$on('SWAP', swapEvent => {
        const swapRequest = {
          ...swapEvent,
          sourceAmount: swapEvent.sourceAmount.toString()
        };
        this.handleTransaction(swapDexSwapMethodMap[swapRequest.swapDex], {swapRequest: swapRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    openDebtSwapModal() {
      const modalInstance = this.openModal(SwapModal);
      modalInstance.swapDebtMode = true;
      modalInstance.sourceAsset = this.asset.symbol;
      modalInstance.sourceAssetBalance = this.assetBalances[this.asset.symbol];
      modalInstance.sourceAssetDebt = this.debtsPerAsset[this.asset.symbol].debt;
      modalInstance.assets = this.assets;
      modalInstance.sourceAssets = BORROWABLE_ASSETS;
      modalInstance.targetAssets = BORROWABLE_ASSETS;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = BORROWABLE_ASSETS.filter(asset => asset !== this.asset.symbol)[0];
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.queryMethod = this.swapDebtQueryMethod();
      modalInstance.$on('SWAP', swapEvent => {
        const swapDebtRequest = {
          ...swapEvent,
          sourceAmount: swapEvent.sourceAmount.toString()
        };
        this.handleTransaction(this.swapDebt, {swapDebtRequest: swapDebtRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    async openAddFromWalletModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      this.updateBalance().then(() => {
        modalInstance.setWalletNativeTokenBalance(this.accountBalance);
        this.$forceUpdate();
      });

      modalInstance.asset = this.asset;
      modalInstance.assetBalance = this.assetBalances && this.assetBalances[this.asset.symbol] ? this.assetBalances[this.asset.symbol] : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.loan = this.fullLoanStatus.debt ? this.fullLoanStatus.debt : 0;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.walletAssetBalance = await this.getWalletAssetBalance();
      modalInstance.noSmartLoan = this.noSmartLoan;
      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
          const value = addFromWalletEvent.value;

          if (this.smartLoanContract.address === NULL_ADDRESS || this.noSmartLoan) {
            if (this.asset.symbol === 'GLP') {
              const request = {
                value: value,
                asset: this.asset.symbol,
                assetAddress: '0xaE64d55a6f09E4263421737397D1fdFA71896a69',
                assetDecimals: config.ASSETS_CONFIG[this.asset.symbol].decimals
              };

              this.handleTransaction(this.createLoanAndDeposit, {request: request}, () => {
                  this.scheduleHardRefresh();
                  this.$forceUpdate();
                },
                (error) => {
                  this.handleTransactionError(error);
                });
            } else {
              this.handleTransaction(this.createAndFundLoan, {
                  asset: addFromWalletEvent.asset,
                  value: value,
                  isLP: false
                }, () => {
                  this.scheduleHardRefresh();
                  this.$forceUpdate();
                },
                (error) => {
                  this.handleTransactionError(error);
                });
            }
          } else {
            if (addFromWalletEvent.asset === 'AVAX') {
              this.handleTransaction(this.fundNativeToken, {value: value}, () => {
                this.$forceUpdate();
              }, (error) => {
                this.handleTransactionError(error);
              }).then(() => {
              });
            } else {
              const fundRequest = {
                value: value,
                asset: this.asset.symbol,
                assetDecimals: config.ASSETS_CONFIG[this.asset.symbol].decimals,
                type: 'ASSET',
              };
              this.handleTransaction(this.fund, {fundRequest: fundRequest}, () => {
                this.$forceUpdate();
              }, (error) => {
                this.handleTransactionError(error);
              }).then(() => {
              });
            }
          }
        }
      });
    },

    openWithdrawModal() {
      const modalInstance = this.openModal(WithdrawModal);
      modalInstance.asset = this.asset;
      modalInstance.assetBalance = this.assetBalances[this.asset.symbol];
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;

      modalInstance.$on('WITHDRAW', withdrawEvent => {
        const value = Number(withdrawEvent.value).toFixed(config.DECIMALS_PRECISION);
        if (withdrawEvent.withdrawAsset === 'AVAX') {
          const withdrawRequest = {
            asset: withdrawEvent.withdrawAsset,
            value: value,
            assetDecimals: config.ASSETS_CONFIG[this.asset.symbol].decimals,
            type: 'ASSET',
          };
          this.handleTransaction(this.withdrawNativeToken, {withdrawRequest: withdrawRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          })
            .then(() => {
            });
        } else {
          const withdrawRequest = {
            asset: this.asset.symbol,
            value: value,
            assetDecimals: config.ASSETS_CONFIG[this.asset.symbol].decimals,
            type: 'ASSET',
          };
          this.handleTransaction(this.withdraw, {withdrawRequest: withdrawRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          })
            .then(() => {
            });
        }
      });
    },

    async openBridgeModal() {
      const modalInstance = this.openModal(BridgeModal);
      modalInstance.noSmartLoan = this.noSmartLoan;
      modalInstance.$on('BRIDGE', bridgeEvent => {
        if (this.smartLoanContract) {
          // To-Do: Lifi Bridge for prime account page
        }
      });
    },

    openRepayModal() {
      const modalInstance = this.openModal(RepayModal);
      modalInstance.asset = this.asset;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.assetDebt = Number(this.debtsPerAsset[this.asset.symbol].debt);
      modalInstance.$on('REPAY', repayEvent => {
        const repayRequest = {
          asset: this.asset.symbol,
          decimals: this.asset.decimals,
          amount: repayEvent.repayValue.toString(),
          isMax: repayEvent.isMax
        };
        this.handleTransaction(this.repay, {repayRequest: repayRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        })
          .then(() => {
          });
      });
    },

    async openWrapModal() {
      const smartContractNativeTokenBalance = await this.getSmartLoanContractNativeTokenBalance();
      const modalInstance = this.openModal(WrapModal);
      modalInstance.asset = this.asset;
      modalInstance.assetBalance = this.assetBalances[this.asset.symbol];
      modalInstance.nativeTokenBalance = smartContractNativeTokenBalance;

      modalInstance.$on('WRAP', value => {
        const wrapRequest = {
          amount: value.toString(),
          decimals: this.asset.decimals,
        };
        this.handleTransaction(this.wrapNativeToken, {wrapRequest: wrapRequest}, () => {
          this.assetBalances[this.asset.symbol] = Number(this.assetBalances[this.asset.symbol]) + Number(wrapRequest.amount);
          this.isBalanceEstimated = true;
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    async claimGLPRewardsAction() {
      const glpRewardRouterContract = new ethers.Contract(config.glpRewardsRouterAddress, GLP_REWARD_ROUTER.abi, this.provider.getSigner());
      const feeGLPTrackerAddress = await glpRewardRouterContract.feeGlpTracker();
      const feeGLPTrackedContract = new ethers.Contract(feeGLPTrackerAddress, GLP_REWARD_TRACKER.abi, this.provider.getSigner());
      const rewards = formatUnits(await feeGLPTrackedContract.claimable(this.smartLoanContract.address), config.ASSETS_CONFIG.AVAX.decimals);
      const modalInstance = this.openModal(ClaimGLPRewardsModal);
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.glpRewardsToClaim = rewards;
      modalInstance.glpRewardsAsset = 'AVAX';

      modalInstance.$on('CLAIM', () => {
        this.handleTransaction(this.claimGLPRewards, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    async getWalletAssetBalance() {
      const tokenContract = new ethers.Contract(addresses[this.asset.symbol], erc20ABI, this.provider.getSigner());
      return await this.getWalletTokenBalance(this.account, this.asset.symbol, tokenContract, false);
    },

    async getSmartLoanContractNativeTokenBalance() {
      const balance = parseFloat(ethers.utils.formatEther(await this.provider.getBalance(this.smartLoanContract.address)));
      return balance;
    },

    watchExternalAssetBalanceUpdate() {
      this.assetBalancesExternalUpdateService.observeExternalAssetBalanceUpdate().subscribe((updateEvent) => {
        if (updateEvent.assetSymbol === this.asset.symbol) {
          this.assetBalances[this.asset.symbol] = updateEvent.balance;
          this.isBalanceEstimated = !updateEvent.isTrueData;
          this.$forceUpdate();
        }
      });
    },

    watchExternalAssetDebtUpdate() {
      this.assetDebtsExternalUpdateService.observeExternalAssetDebtUpdate().subscribe((updateEvent) => {
        if (updateEvent.assetSymbol === this.asset.symbol) {
          this.debtsPerAsset[this.asset.symbol].debt = updateEvent.debt;
          this.isDebtEstimated = !updateEvent.isTrueData;
          this.$forceUpdate();
        }
      });
    },

    watchAssetBalancesDataRefreshEvent() {
      this.dataRefreshEventService.assetBalancesDataRefreshEvent$.subscribe(() => {
        this.isBalanceEstimated = false;
        this.disableAllButtons = false;
        this.progressBarService.emitProgressBarSuccessState();
        this.$forceUpdate();
      });
    },

    watchDebtsPerAssetDataRefreshEvent() {
      this.dataRefreshEventService.debtsPerAssetDataRefreshEvent$.subscribe(() => {
        this.isDebtEstimated = false;
        this.disableAllButtons = false;
        this.progressBarService.emitProgressBarSuccessState();
        this.$forceUpdate();
      });
    },

    watchHardRefreshScheduledEvent() {
      this.dataRefreshEventService.hardRefreshScheduledEvent$.subscribe(() => {
        this.disableAllButtons = true;
        this.$forceUpdate();
      });
    },

    watchHealth() {
      this.healthService.observeHealth().subscribe(health => {
        this.healthLoaded = true;
      });
    },

    watchAssetApysRefreshScheduledEvent() {
      this.dataRefreshEventService.assetApysDataRefresh$.subscribe(() => {
        this.$forceUpdate();
      });
    },

    watchExternalTotalStakedUpdate() {
      this.stakedExternalUpdateService.observeExternalTotalStakedUpdate().subscribe((updateEvent) => {
        if (updateEvent.assetSymbol === this.asset.symbol) {
          if (updateEvent.action === 'STAKE') {
            this.totalStaked = Number(this.totalStaked) + Number(updateEvent.stakedChange);
          } else if (updateEvent.action === 'UNSTAKE') {
            this.totalStaked = Number(this.totalStaked) - Number(updateEvent.stakedChange);
          }
          this.$forceUpdate();
        }
      });
    },

    watchFarmRefreshEvent() {
      this.farmService.observeRefreshFarm().subscribe(async () => {
        if (this.availableFarms) {
          this.totalStaked = this.availableFarms.reduce((acc, farm) => acc + parseFloat(farm.totalStaked), 0);
        }
      });
    },

    setupAvailableFarms() {
      this.availableFarms = config.FARMED_TOKENS_CONFIG[this.asset.symbol];
    },

    scheduleHardRefresh() {
      this.progressBarService.emitProgressBarInProgressState();
      this.dataRefreshEventService.emitHardRefreshScheduledEvent();
    },

    watchProgressBarState() {
      this.progressBarService.progressBarState$.subscribe((state) => {
        switch (state) {
          case 'MINING' : {
            this.disableAllButtons = true;
            break;
          }
          case 'SUCCESS': {
            this.disableAllButtons = false;
            break;
          }
          case 'ERROR' : {
            this.disableAllButtons = false;
            this.isBalanceEstimated = false;
            this.isDebtEstimated = false;
            break;
          }
          case 'CANCELLED' : {
            this.disableAllButtons = false;
            this.isBalanceEstimated = false;
            this.isDebtEstimated = false;
            break;
          }
        }
      });
    },

    handleTransactionError(error) {
      console.error('handleTransactionError');
      console.error(error);
      if (error && error.data && error.data.message) {
        console.error(error.data.message)
      }
      if (!error) {
        return;
      }
      if (error && error.code && error.code === 4001 || error.code === -32603) {
        if (error.message.toLowerCase().includes('insufficient output amount')) {
          this.progressBarService.emitProgressBarErrorState('Insufficient slippage.');
        } else if (error.data.message.includes('execution reverted: Received amount of tokens are less then expected')) {
          this.progressBarService.emitProgressBarErrorState('Max acceptable slippage exceeded. Please try again.')
        } else {
          this.progressBarService.emitProgressBarCancelledState();
        }
      } else {
        if (error.includes('Failed to swap')) {
          this.progressBarService.emitProgressBarErrorState('Slippage might be too low.');
          return;
        }
        this.progressBarService.emitProgressBarErrorState();
      }
      this.closeModal();
      this.disableAllButtons = false;
      this.isBalanceEstimated = false;
      this.isBalanceEstimated = false;
    },

    setupPoolsApy() {
      this.poolService.observePools().subscribe(pools => {
        pools.forEach(pool => {
          this.borrowApyPerPool[pool.asset.symbol] = pool.borrowingAPY;
        });
      });
    },
  },
  watch: {
    smartLoanContract: {
      handler(smartLoanContract) {
        if (smartLoanContract) {
          this.setupActionsConfiguration();
        }
      },
    },

    pools: {
      handler(pools) {
        this.setupActionsConfiguration();
      },
      immediate: true
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.fund-table-row-component {
  height: 60px;
  transition: all 200ms;

  &.expanded {
    height: 433px;
  }

  .table__row {
    display: grid;
    grid-template-columns: repeat(6, 1fr) 90px 76px 102px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.asset {
        align-items: center;

        .asset__icon {
          width: 20px;
          height: 20px;
          opacity: var(--asset-table-row__icon-opacity);
        }

        .asset__info {
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-left: 8px;
          font-weight: 500;
        }

        .asset__loan {
          font-size: $font-size-xxs;
          color: var(--asset-table-row__asset-loan-color);
        }
      }

      &.balance {
        align-items: flex-end;
      }

      &.farmed {
        align-items: flex-end;
      }

      &.loan {
        align-items: flex-end;
      }

      &.impact {
        font-weight: 500;
        align-items: center;
        justify-content: center;
      }

      &.trend {
        justify-content: center;
        align-items: center;
        margin-left: 9px;

        .trend__chart-change {
          display: flex;
          flex-direction: column;
          font-size: $font-size-xxs;
          align-items: center;
          cursor: pointer;
        }

        .chart__icon-button {
          margin-left: 7px;
        }
      }

      &.price {
        justify-content: flex-end;
        align-items: center;
        font-weight: 500;
      }

      &.actions {
        align-items: center;

        .actions__icon-button {
          &:not(:last-child) {
            margin-right: 12px;
          }
        }
      }

      &.table__cell--double-value {
        flex-direction: column;
        justify-content: center;

        .double-value__pieces {
          font-size: $font-size-xsm;
          font-weight: 600;
        }

        .double-value__usd {
          font-size: $font-size-xxs;
          color: var(--asset-table-row__double-value-color);
          font-weight: 500;
        }

        &.loan {
          .double-value__pieces {
            font-weight: 500;
          }
        }
      }

      .no-value-dash {
        height: 1px;
        width: 15px;
        background-color: var(--asset-table-row__no-value-dash-color);
      }
    }
  }

  .chart-container {
    margin: 2rem 0;

    .colored-value {
      font-weight: 500;
    }
  }
}

.action-button {
  &:not(:last-child) {
    margin-right: 12px;
  }
}

</style>
