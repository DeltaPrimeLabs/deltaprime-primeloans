<template>
  <div class="sprime-panel-component" v-bind:class="{'sprime-panel-component--expanded': expanded}">
    <div class="header-actions">
      <FlatButton v-on:buttonClick="openRedeemSPrimeModal()" :active="true">buy prime <img class="buy-prime-logo"
                                                                                           src="src/assets/logo/prime.svg"/>
      </FlatButton>
      <div v-on:click="toggleExpand()">
        <DeltaIcon class="chevron" v-bind:class="{'chevron--expanded': expanded}"
                   :icon-src="'src/assets/icons/chevron-down.svg'" :size="21"></DeltaIcon>
      </div>
    </div>
    <div class="sprime-panel__actions sprime-panel__actions--collapsed">
      <div class="sprime">
        <img class="sprime-logo"
             src="src/assets/logo/sprime.svg"/>
        <div class="sprime__text">
          $sPRIME
        </div>
      </div>
      <div class="actions-info">
        <div class="actions-info__entry">
          <div class="actions-info__label">Total value:</div>
          <div class="actions-info__value">$ {{ formatTokenBalance(value, 18, true) }}</div>
        </div>
        <div class="actions-info__divider"></div>
        <div class="actions-info__entry">
          <div class="actions-info__label">Distribution:</div>
          <img :src="getDistributionIcon" class="actions-info__distribution-icon">
        </div>
        <div class="actions-info__divider"></div>
        <div class="actions-info__entry">
          <div class="actions-info__label">Governance power:</div>
          <div class="actions-info__value">{{ governancePoints }}</div>
        </div>
      </div>
    </div>
    <div class="sprime-panel__actions sprime-panel__actions--expanded">
      <div class="sprime">
        <DoubleAssetIcon :size="'BIG'" :primary="'sPRIME'" :secondary="secondAsset"></DoubleAssetIcon>
        <div>
          $sPRIME
        </div>
      </div>
      <div class="actions">
        <FlatButton v-on:buttonClick="openMintSPrimeModal()" :active="true">mint</FlatButton>
        <FlatButton v-on:buttonClick="openRebalanceSPrimeModal()" :active="value > 0">rebalance</FlatButton>
        <FlatButton v-on:buttonClick="openRedeemSPrimeModal()" :active="value > 0">redeem</FlatButton>
      </div>
    </div>
    <div class="sprime-panel__divider"></div>
    <div class="sprime-panel__body">
      <div class="stats">
        <div class="stat">
          <div class="stat__title">Total value</div>
          <div class="stat__value">{{ formatTokenBalance(value, 18, true) }}</div>
        </div>
        <div class="stat">
          <div class="stat__title">Revenue received
            <InfoIcon class="stat__info-icon" :size="16" :tooltip="{ content: ''}"></InfoIcon>
          </div>
          <div class="stat__value revenue"><FlatButton :active="false">soon</FlatButton></div>
        </div>
        <div class="stat">
          <div class="stat__title">YTD APR
            <InfoIcon class="stat__info-icon" :size="16" :tooltip="{ content: ''}"></InfoIcon>
          </div>
          <div class="stat__value">TO DO {{ 0.15512 | percent }}</div>
        </div>
      </div>
      <div class="distribution">
        <div class="distribution__title">Distribution</div>
        <div class="chart-container">
          <div class="distribution-chart-line"></div>
          <DistributionChart :data="chartData" :active-index="7"></DistributionChart>
        </div>
      </div>
      <div class="governance">
        <div class="governance__title">Governance power</div>
        <div class="power-gauge">
          <div class="gauge__value">
            {{ governancePoints }}
          </div>
        </div>
      </div>
      <div class="rates">
        <div class="rate">
          <div class="rate__title">Accrual rate (yearly)</div>
          <div class="rate__value">{{ governanceRate }}</div>
        </div>
        <div class="rate">
          <div class="rate__title">Max. accrual rate</div>
          <div class="rate__value">58</div>
          <div class="rate__extra-info">(Borrow 10$ more)</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>

import FlatButton from './FlatButton.vue';
import {mapActions, mapState} from 'vuex';
import config from '../config';
import {combineLatest} from 'rxjs';
import MintsPrimeModal from './MintsPrimeModal.vue';
import erc20ABI from '../../test/abis/ERC20.json';
import {getTraderJoeV2IdSlippageFromPriceSlippage, getUniswapV3SlippageFromPriceSlippage} from '../utils/calculate';
import RedeemsPrimeModal from './RedeemsPrimeModal.vue';
import RebalancesPrimeModal from './RebalancesPrimeModal.vue';
import DoubleAssetIcon from './DoubleAssetIcon.vue';
import DistributionChart from "./DistributionChart.vue";
import DeltaIcon from "./DeltaIcon.vue";
import InfoIcon from "./InfoIcon.vue";

const ethers = require('ethers');

let TOKEN_ADDRESSES;

const DistributionType = {
  RIGHT_NEUTRAL: 'RIGHT_NEUTRAL',
  LEFT_NEUTRAL: 'LEFT_NEUTRAL',
  LEFT_POSITIVE: 'LEFT_POSITIVE',
  LEFT_NEGATIVE: 'LEFT_NEGATIVE',
  RIGHT_NEGATIVE: 'RIGHT_NEGATIVE',
}

const DISTRIBUTION_ICON_DICTIONARY = {
  [DistributionType.RIGHT_NEUTRAL]: 'right-neutral',
  [DistributionType.LEFT_NEUTRAL]: 'left-neutral',
  [DistributionType.LEFT_POSITIVE]: 'left-positive',
  [DistributionType.LEFT_NEGATIVE]: 'left-negative',
  [DistributionType.RIGHT_NEGATIVE]: 'right-negative',
}

export default {
  name: 'SPrimePanel',
  components: {InfoIcon, DeltaIcon, DoubleAssetIcon, DistributionChart, FlatButton},
  props: {
    isPrimeAccount: false
  },
  data() {
    return {
      dex: null,
      secondAsset: null,
      sPrimeConfig: null,
      value: null,
      governancePoints: null,
      governanceRate: null,
      expanded: false,
      distributionType: DistributionType.RIGHT_NEGATIVE,
      chartData: [
        {x: 1, y: 1, showTick: true, positive: false},
        {x: 2, y: 2, showTick: false, positive: false},
        {x: 3, y: 3, showTick: false, positive: false},
        {x: 4, y: 4, showTick: false, positive: false},
        {x: 5, y: 2, showTick: true, positive: false},
        {x: 6, y: 0, showTick: false, positive: false},
        {x: 7, y: 0, showTick: false, positive: false},
        {x: 8, y: 3, showTick: true, positive: true},
        {x: 9, y: 0, showTick: false, positive: false},
        {x: 10, y: 0, showTick: false, positive: false},
        {x: 11, y: 0, showTick: false, positive: false},
        {x: 12, y: 0, showTick: false, positive: false},
        {x: 13, y: 0, showTick: false, positive: false},
        {x: 14, y: 0, showTick: false, positive: false},
        {x: 15, y: 0, showTick: false, positive: false},
      ]
    };
  },
  mounted() {
    this.setupFiles();
    this.dex = config.SPRIME_CONFIG.default;
    this.secondAsset = config.SPRIME_CONFIG[this.dex].default;
    this.sPrimeConfig = config.SPRIME_CONFIG[this.dex][this.secondAsset];

    combineLatest([
      this.accountService.observeAccountLoaded(),
      this.providerService.observeProviderCreated()
    ]).subscribe(() => {
      this.fetchSPrimeData();
    });

    this.sPrimeService.observeSPrimeValue().subscribe(value => {
      this.value = value
    });

    this.accountService.observeAccountLoaded().subscribe(() => {
      this.fetchVPrimeData();
    });

    this.vPrimeService.observeVPrimePoints().subscribe(points => {
      this.governancePoints = points.toExponential(1);
    });

    this.vPrimeService.observeVPrimeRate().subscribe(rate => {
      this.governanceRate = rate.toExponential(2);
    });
  },
  watch: {},
  computed: {
    ...mapState('serviceRegistry', [
      'sPrimeService',
      'vPrimeService',
      'providerService',
      'accountService',
      'traderJoeService',
      'uniswapV3Service',
      'themeService',
      'progressBarService'
    ]),
    ...mapState('network', ['provider', 'account']),
    getDistributionIcon() {
      return `src/assets/icons/sprime-distribution/${DISTRIBUTION_ICON_DICTIONARY[this.distributionType]}${this.themeService.themeChange$.value === 'LIGHT' ? '' : '--dark' }.svg`;
    }
  },
  methods: {
    ...mapActions('sPrimeStore', [
      'sPrimeMint',
      'sPrimeRebalance',
      'sPrimeRedeem'
    ]),
    async setupFiles() {
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },
    async openMintSPrimeModal() {
      console.log('openMintSPrimeModal')
      let activeId, currentPrice;
      if (this.dex === 'TRADERJOEV2') {
        [, activeId] = await this
            .traderJoeService
            .getLBPairReservesAndActiveBin(this.sPrimeConfig.lbAddress, this.provider)
      } else {
        [currentPrice, activeId] = await this
            .uniswapV3Service
            .getPriceAndActiveId(this.sPrimeConfig.poolAddress, this.provider)
      }
      console.log('activeId: ', activeId)

      const [primeBalance, secondAssetBalance] = await Promise.all(
          [
            this.fetchUserTokenBalance('PRIME'),
            this.fetchUserTokenBalance(this.secondAsset)
          ]
      );

      const nativeTokenBalance = parseFloat(ethers.utils.formatEther(await this.provider.getBalance(this.account)));
      console.log(nativeTokenBalance);

      console.log(primeBalance);
      console.log(secondAssetBalance);

      const modalInstance = this.openModal(MintsPrimeModal);
      modalInstance.primeBalance = primeBalance;
      modalInstance.secondAssetBalance = secondAssetBalance;
      modalInstance.secondAssetSymbol = this.secondAsset;
      modalInstance.nativeTokenBalance = nativeTokenBalance;
      modalInstance.isSecondAssetNative = this.secondAsset === config.nativeToken;
      modalInstance.$on('MINT', sPrimeMintEvent => {
        console.log(sPrimeMintEvent);
        const idSlippage = this.dex === 'TRADERJOEV2' ?
            getTraderJoeV2IdSlippageFromPriceSlippage(sPrimeMintEvent.slippage / 100, config.SPRIME_CONFIG.TRADERJOEV2[this.secondAsset].binStep)
            : getUniswapV3SlippageFromPriceSlippage(currentPrice, sPrimeMintEvent.slippage / 100);

        const sPrimeMintRequest = {
          sPrimeAddress: this.sPrimeConfig.sPrimeAddress,
          secondAsset: this.secondAsset,
          isRebalance: sPrimeMintEvent.rebalance,
          amountPrime: sPrimeMintEvent.primeAmount,
          amountSecond: sPrimeMintEvent.secondAmount,
          idSlippage: idSlippage,
          slippage: sPrimeMintEvent.slippage / 100,
          dex: this.dex,
          activeId: activeId
        };
        this.handleTransaction(this.sPrimeMint, {sPrimeMintRequest: sPrimeMintRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },
    async openRebalanceSPrimeModal() {
      let activeId, currentPrice;
      if (this.dex === 'TRADERJOEV2') {
        [, activeId] = await this
            .traderJoeService
            .getLBPairReservesAndActiveBin(this.sPrimeConfig.lbAddress, this.provider)
      } else {
        [currentPrice, activeId] = await this
            .uniswapV3Service
            .getPriceAndActiveId(this.sPrimeConfig.poolAddress, this.provider)
      }
      const modalInstance = this.openModal(RebalancesPrimeModal);
      modalInstance.secondAssetSymbol = this.secondAsset;

      modalInstance.$on('REBALANCE', event => {
        const idSlippage = this.dex === 'TRADERJOEV2' ?
            getTraderJoeV2IdSlippageFromPriceSlippage(event.slippage / 100, config.SPRIME_CONFIG.TRADERJOEV2[this.secondAsset].binStep)
            : getUniswapV3SlippageFromPriceSlippage(currentPrice, event.slippage / 100);

        let sPrimeRebalanceRequest = {
          sPrimeAddress: this.sPrimeConfig.sPrimeAddress,
          secondAsset: this.secondAsset,
          isRebalance: true,
          idSlippage: idSlippage,
          slippage: event.slippage / 100,
          dex: this.dex,
          activeId: activeId
        };
        console.log('sPrimeRebalanceRequest: ', sPrimeRebalanceRequest)
        this.handleTransaction(this.sPrimeRebalance, {sPrimeRebalanceRequest: sPrimeRebalanceRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },
    async openRedeemSPrimeModal() {
      console.log(this.sPrimeConfig);

      let [primeBalance, secondAssetBalance] = await Promise.all(
          [this.fetchUserTokenBalance('PRIME'),
            this.fetchUserTokenBalance(this.secondAsset)]
      );

      const sPrimeTokenContract = new ethers.Contract(this.sPrimeConfig.sPrimeAddress, erc20ABI, this.provider.getSigner());
      const sPrimeBalance = await this.getWalletTokenBalance(this.account, 'sPRIME', sPrimeTokenContract, 18);

      console.log(sPrimeBalance);

      const modalInstance = this.openModal(RedeemsPrimeModal);
      modalInstance.primeBalance = primeBalance;
      modalInstance.secondAssetBalance = secondAssetBalance;
      modalInstance.secondAssetSymbol = this.secondAsset;
      modalInstance.sPrimeBalance = sPrimeBalance;
      modalInstance.$on('REDEEM', sPrimeRedeemEvent => {
        let sPrimeRedeemRequest = {
          sPrimeAddress: this.sPrimeConfig.sPrimeAddress,
          secondAsset: this.secondAsset,
          share: sPrimeRedeemEvent.sPrimeToRedeem.toFixed(18)
        };
        this.handleTransaction(this.sPrimeRedeem, {sPrimeRedeemRequest: sPrimeRedeemRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },
    fetchSPrimeData() {
      this.sPrimeService.emitRefreshSPrimeData(this.provider, this.sPrimeConfig.sPrimeAddress, this.dex, this.secondAsset, this.account);
    },
    fetchVPrimeData() {
      this.vPrimeService.emitRefreshVPrimeData(config.VPRIME_CONFIG.address, this.account);
    },
    async fetchUserTokenBalance(tokenSymbol) {
      const contract = new ethers.Contract(TOKEN_ADDRESSES[tokenSymbol], erc20ABI, this.provider.getSigner());
      console.log(contract);

      return this.getWalletTokenBalance(
          this.account,
          tokenSymbol,
          contract,
          config.ASSETS_CONFIG[tokenSymbol].decimals
      );
    },

    handleTransactionError(error) {
      if (String(error) === '[object Object]' || typeof error === 'object') {
        switch (error.code) {
          case 4001:
            this.progressBarService.emitProgressBarCancelledState()
            this.closeModal();
            break;
        }
      }
    },

    toggleExpand() {
      this.expanded = !this.expanded;
    }
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.sprime-panel-component {
  position: relative;
  height: 60px;
  transition: height 200ms ease-in-out;
  display: flex;
  flex-direction: column;
  border-radius: 35px;
  background-color: var(--s-prime-panel__panel-background-color);
  box-shadow: var(--s-prime-panel__panel-box-shadow);
  margin-top: 30px;
  overflow: hidden;

  .header-actions {
    position: absolute;
    top: 17px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    z-index: 1;

    .chevron {
      cursor: pointer;
      background: var(--s-prime-panel__chevron-color);
      transition: transform 200ms ease-in-out;

      &:hover {
        background: var(--s-prime-panel__chevron-color--hover);
      }

      &.chevron--expanded {
        transform: rotate(180deg);
      }
    }

    .buy-prime-logo {
      width: 20px;
      height: 20px;
      margin-left: 6px;
    }
  }

  &.sprime-panel-component--expanded {
    height: 330px;

    .sprime-panel__actions--expanded {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    .sprime-panel__actions--collapsed {
      opacity: 0;
      transform: translateY(100%) !important;
      pointer-events: none;
    }
  }

  .sprime-panel__actions {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 16px 0;
    transition: opacity 200ms ease-in-out, transform 200ms ease-in-out;
    transform: translateY(-100%);

    &--expanded {
      opacity: 0;
      pointer-events: none;
    }

    &--collapsed {
      position: absolute;
      width: 100%;
      transform: translateY(0);
      padding: 20px 0;

      .sprime {
        position: absolute;
        left: 24px;
        top: 19px;
      }

      .sprime-logo {
        width: 22px;
        height: 22px;
        margin-right: 8px;
      }

      .sprime__text {
        color: var(--s-prime-panel__secondary-text-color);
        font-size: 16px;
        font-weight: 600;
      }

      .actions-info {
        display: flex;
        justify-content: center;
        align-items: center;

        .actions-info__entry:not(:last-child) {
          margin-right: 19px;
        }

        .actions-info__divider {
          background: var(--s-prime-panel__actions-info-divider-background);
          margin-right: 19px;
          height: 20px;
          width: 2px;
          border-radius: 2px;
        }

        .actions-info__entry {
          display: flex;
          font-size: 16px;
          font-weight: 500;
        }

        .actions-info__label {
          margin-right: 8px;
          color: var(--s-prime-panel__main-text-color);
        }

        .actions-info__value {
          color: var(--s-prime-panel__secondary-text-color);
        }

        .actions-info__distribution-icon {
          margin-top: -5px;
        }
      }
    }

    .sprime {
      margin-right: 40px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      color: var(--s-prime-panel__sprime-color);
      font-size: 16px;
      font-weight: 600;
    }

    .actions {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;

      .flat-button-component:not(:last-child) {
        margin-right: 20px;
      }
    }
  }

  .sprime-panel__divider {
    height: 2px;
    width: 100%;
    background: var(--s-prime-panel__divider-background);
  }

  .sprime-panel__body {
    padding: 30px 50px;
    display: grid;
    grid-template-columns: 250px 1fr 280px 170px;

    .stats {
      display: flex;
      flex-direction: column;
      border-style: solid;
      border-width: 0 2px 0 0;
      border-image-source: var(--stats-bar-beta__divider-background);
      border-image-slice: 1;
      padding-top: 10px;

      .stat {
        display: flex;
        flex-direction: column;
        margin-bottom: 24px;

        .stat__info-icon {
          margin-left: 6px;

          &.revenue {
            width: 50px;
          }
        }

        .stat__title {
          display: flex;
          align-items: center;
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 6px;
          color: var(--s-prime-panel__main-text-color);
        }

        .stat__value {
          font-size: 18px;
          font-weight: 500;
          color: var(--s-prime-panel__secondary-text-color);
        }
      }
    }

    .distribution {
      border-style: solid;
      border-width: 0 2px 0 0;
      border-image-source: var(--stats-bar-beta__divider-background);
      border-image-slice: 1;
      padding-top: 10px;

      .distribution__title {
        color: var(--s-prime-panel__main-text-color);
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 10px;
        text-align: center;
      }

      .chart-container {
        display: flex;
        flex-direction: column;
        position: relative;
        margin: 0 auto;
        height: 160px;
        width: 280px;

        div {
          width: 100%;
          height: 100%;
        }

        .distribution-chart-line {
          flex-shrink: 0;
          width: calc(100% - 6px);
          margin: 0 auto 14px auto;
          height: 2px;
          background: linear-gradient(to right, var(--distribution-chart__line-background--1) 30%, var(--distribution-chart__line-background--2) 60%, var(--distribution-chart__line-background--3) 80%)
        }
      }
    }

    .governance {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 10px;

      .governance__title {
        margin-bottom: 20px;
        color: var(--s-prime-panel__main-text-color);
        font-size: 16px;
        font-weight: 500;
      }

      .power-gauge {
        position: relative;
        width: 160px;
        height: 160px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        box-shadow: var(--s-prime-panel__gauge-box-shadow);

        &:before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--s-prime-panel__gauge-border);
          border-radius: 50%;
          mask-image: radial-gradient(closest-side, transparent calc(100% - 2px), black calc(100% - 2px));
        }

        .gauge__value {
          font-size: 40px;
          font-weight: 600;
          color: var(--s-prime-panel__gauge-text-color);
        }
      }
    }

    .rates {
      padding-top: 10px;

      .rate {
        display: flex;
        flex-direction: column;

        &:not(:last-child) {
          margin-bottom: 42px;
        }

        .rate__title {
          font-size: 16px;
          font-weight: 500;
          color: var(--s-prime-panel__main-text-color);
          padding-bottom: 6px;
        }

        .rate__value {
          font-size: 18px;
          font-weight: 500;
          color: var(--s-prime-panel__secondary-text-color);
        }

        .rate__extra-info {
          font-size: 14px;
          font-weight: 500;
          color: var(--s-prime-panel__main-text-color);
          margin-top: 4px;
        }
      }
    }
  }
}


</style>
