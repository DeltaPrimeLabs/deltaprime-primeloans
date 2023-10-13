<template>
  <div v-if="asset" class="staking-asset-component">
    <div class="staking-asset">
      <div class="staking-asset__header"
           v-bind:class="{'body-collapsed': bodyHasCollapsed, 'round-bottom': stakingHeaderRoundBottom}"
           v-on:click="toggleExpanded()">
        <div class="header__cell cell__asset">
          <div class="asset">
            <div class="asset__icon" v-bind:class="{'asset__icon--double': asset.primary && asset.secondary}">
              <img v-if="!(asset.primary && asset.secondary)" :src="logoSrc(asset.symbol)">
              <DoubleAssetIcon v-if="asset.primary && asset.secondary"
                               :primary="asset.primary"
                               :secondary="asset.secondary">
              </DoubleAssetIcon>
            </div>
            <div class="asset__info">
              <div class="asset__name">
                {{ asset.name }}
              </div>
              <div class="asset__dex" v-if="asset.dex">
                from {{ asset.dex }}
              </div>
            </div>
          </div>
        </div>

        <div class="header__cell cell__staked">
        </div>

        <div class="header__cell cell__available">
          <div class="header__cell__label">
            Available:
          </div>
          <div class="header__cell__value">
            <span v-if="isAvailableEstimated">~</span>{{ formatTokenBalance(available, 10, true) }}
          </div>
        </div>

        <div class="header__cell cell__staked">
          <div class="header__cell__label">Staked:</div>
          <div class="header__cell__value">
            <span v-if="isTotalStakedEstimated">~</span>{{ formatTokenBalance(totalStaked, 10, true) }}
          </div>
        </div>

        <div class="header__cell cell__max-apy">
          <div class="header__cell__label">Max APY:</div>
          <div class="header__cell__value">{{ maxLeveragedApy | percent }}</div>
        </div>

        <div class="header__cell cell__protocols">
          <div class="header__cell__label">Protocols:</div>
          <div class="protocols-list" v-if="availableFarms && availableFarms.length > 0">
            <img v-for="protocol in availableFarms" class="protocol__icon"
                 :src="`src/assets/logo/${protocolLogo(protocol)}`">
          </div>
        </div>

        <div class="header__cell cell__action" v-bind:class="{'expanded': tableBodyExpanded}">
          <DeltaIcon class="chevron" :icon-src="'src/assets/icons/chevron-down.svg'" :size="21"></DeltaIcon>
        </div>
      </div>

      <div class="staking-protocols" v-bind:class="{'expanded': tableBodyExpanded}"
           :style="{height: calculateStakingProtocolsHeight}">

        <div v-if="autoCompoundingFarms.length > 0" class="compounding__divider">
          <span class="divider__title">Auto-compounding</span>
          <InfoIcon :tooltip="{content: 'These farms automatically swap your reward token for the deposited token and restakes it.', classes: 'info-tooltip long', placement: 'top'}"></InfoIcon>
        </div>

        <div v-if="autoCompoundingFarms.length > 0" class="protocols__table">
          <div class="table__header">
            <div class="table__header__cell asset">Asset & protocol</div>
            <div class="table__header__cell">Staked&nbsp;
              <div class="info__icon__wrapper">
                <InfoIcon :tooltip="{content: 'How many tokens you are currently staking.', classes: 'info-tooltip long', placement: 'top'}"></InfoIcon>
              </div>
            </div>
            <div class="table__header__cell"></div>
            <div class="table__header__cell">Min. APY
              <div class="info__icon__wrapper">
                <InfoIcon :tooltip="{content: minApyTooltip, classes: 'info-tooltip long', placement: 'top'}"></InfoIcon>
              </div>
            </div>
            <div class="table__header__cell">Max. APY
              <div class="info__icon__wrapper">
                <InfoIcon :tooltip="{content: maxApyTooltip, classes: 'info-tooltip long', placement: 'top'}"></InfoIcon>
              </div>
            </div>
            <div class="table__header__cell">Actions</div>
          </div>

          <div class="table__body">
            <div></div>
            <StakingProtocolTableRow v-for="(farm, index) in autoCompoundingFarms"
                                     v-bind:key="index"
                                     :farm="farm"
                                     :asset="asset"
                                     v-on:stakedChange="stakedChange">
            </StakingProtocolTableRow>
          </div>

        </div>


        <div v-if="normalFarms.length > 0" class="compounding__divider">
          <span class="divider__title">No auto-compounding</span>
          <InfoIcon :tooltip="{content: 'These farms require manual claiming of rewards by (un)staking part of the farmed assets.', classes: 'info-tooltip long', placement: 'top'}"></InfoIcon>
        </div>

        <div class="protocols__table protocol__table--no-header">
<!--          <div class="table__header">
            <div class="table__header__cell asset">Asset & protocol</div>
            <div class="table__header__cell">Staked&nbsp;
              <div class="info__icon__wrapper">
                <InfoIcon :tooltip="{content: 'How many tokens you are currently staking.', classes: 'info-tooltip long', placement: 'top'}"></InfoIcon>
              </div>
            </div>
            <div class="table__header__cell">Rewards</div>
            <div class="table__header__cell">Min. APY
              <div class="info__icon__wrapper">
                <InfoIcon :tooltip="{content: minApyTooltip, classes: 'info-tooltip long', placement: 'top'}"></InfoIcon>
              </div>
            </div>
            <div class="table__header__cell">Max. APY
              <div class="info__icon__wrapper">
                <InfoIcon :tooltip="{content: maxApyTooltip, classes: 'info-tooltip long', placement: 'top'}"></InfoIcon>
              </div>
            </div>
            <div class="table__header__cell">Actions</div>
          </div>-->

          <div class="table__body">
            <StakingProtocolTableRow v-for="(farm, index) in normalFarms"
                                     v-bind:key="index"
                                     :farm="farm"
                                     :asset="asset"
                                     v-on:stakedChange="stakedChange">
            </StakingProtocolTableRow>
          </div>

        </div>
      </div>

    </div>
  </div>
</template>

<script>
import StakingProtocolTableRow from './StakingProtocolTableRow';
import config from '@/config';
import {mapState} from 'vuex';
import DoubleAssetIcon from './DoubleAssetIcon';
import {calculateMaxApy} from '../utils/calculate';
import DeltaIcon from "./DeltaIcon.vue";
import InfoIcon from "./InfoIcon.vue";


export default {
  name: 'StakingAssetBeta',
  components: {InfoIcon, DeltaIcon, DoubleAssetIcon, StakingProtocolTableRow},
  props: {
    assetSymbol: {
      required: true,
    }
  },
  data() {
    return {
      tableBodyExpanded: false,
      bodyHasCollapsed: true,
      stakingHeaderRoundBottom: false,
      maxLeveragedApy: 0,
      totalStaked: 0,
      available: 0,
      availableFarms: [],
      protocolConfig: null,
      isTotalStakedEstimated: false,
      isAvailableEstimated: false,
      assetBalances: {},
      lpBalances: {},
      autoCompoundingFarms: [],
      normalFarms: []
    };
  },
  mounted() {
    this.setupAvailableProtocols();
    this.watchExternalAssetBalanceUpdate();
    this.watchExternalTotalStakedUpdate();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchFarmRefreshEvent();
  },
  computed: {
    ...mapState('fundsStore', ['smartLoanContract', 'noSmartLoan']),
    ...mapState('poolStore', ['pools']),
    ...mapState('serviceRegistry', ['assetBalancesExternalUpdateService', 'stakedExternalUpdateService', 'dataRefreshEventService', 'farmService']),
    asset() {
      return config.ASSETS_CONFIG[this.assetSymbol] ? config.ASSETS_CONFIG[this.assetSymbol] : config.LP_ASSETS_CONFIG[this.assetSymbol];
    },
    calculateStakingProtocolsHeight() {
      const simpleProtocolsWithBanner = ['YY_PNG_AVAX_USDC_LP', 'YY_PNG_AVAX_ETH_LP', 'YY_TJ_AVAX_sAVAX_LP'];
      const tokensWithSplitCompoundingFarms = ['AVAX', 'sAVAX', 'USDC'];
      const headerHeight = 53;
      if (this.availableFarms) {
        let heightOfRows = 0;
        Object.values(this.availableFarms).forEach(farm => {
          console.log(farm);
          if (farm.protocol === 'VECTOR_FINANCE' && this.asset.symbol === 'USDC') {
            heightOfRows += 26;
          }

          if (farm.banner) {
            heightOfRows += 10;
          }

          if (tokensWithSplitCompoundingFarms.includes(farm.token) && !farm.autoCompounding) {
            heightOfRows -= 38;
          }

          if (farm.token === 'USDC') {
            heightOfRows -= 10;
          }

          heightOfRows += 102;
        });

        return this.tableBodyExpanded ? `${heightOfRows + headerHeight}px` : 0;
      }
    },

    maxApyTooltip() {
      return `The APY if you would borrow the lowest-interest asset from 100% to 10%, and put your total value into this farm.`;
    },
    minApyTooltip() {
      return `The APY of the farm.`;
    }
  },

  methods: {
    toggleExpanded() {
      if (!this.tableBodyExpanded) {
        this.tableBodyExpanded = true;
        this.bodyHasCollapsed = false;
        this.stakingHeaderRoundBottom = false;
      } else {
        this.tableBodyExpanded = false;
        setTimeout(() => {
          this.bodyHasCollapsed = true;
        }, 200);
        setTimeout(() => {
          this.stakingHeaderRoundBottom = true;
        }, 180);
      }
    },

    async setupMaxStakingApy() {
      let maxApy = 0;

      for (let farm of this.availableFarms) {
        const apy = farm.currentApy;
        if (apy > maxApy) {
          maxApy = apy;
        }
      }
      let assetApr = this.asset.apy && this.asset.symbol !== 'GLP' ? this.asset.apy / 100 : 0;

      this.maxLeveragedApy = calculateMaxApy(this.pools, (1 + maxApy + assetApr) - 1);

    },

    setupAvailable() {
      if (this.asset && !this.noSmartLoan) {
        if (this.asset.secondary) {
          this.available = this.lpBalances && this.lpBalances[this.assetSymbol];
        } else {
          this.available = this.assetBalances && this.assetBalances[this.assetSymbol];
        }
      }
    },

    setupAvailableProtocols() {
      this.availableFarms = config.FARMED_TOKENS_CONFIG[this.assetSymbol];
      this.autoCompoundingFarms = this.availableFarms.filter(farm => farm.autoCompounding);
      this.normalFarms = this.availableFarms.filter(farm => !farm.autoCompounding);
    },

    protocolLogo(protocol) {
      return config.PROTOCOLS_CONFIG[protocol.protocol].logo;
    },

    stakedChange() {
      this.isTotalStakedEstimated = false;
    },

    watchExternalAssetBalanceUpdate() {
      this.assetBalancesExternalUpdateService.observeExternalAssetBalanceUpdate().subscribe((updateEvent) => {
        if (updateEvent.assetSymbol === this.asset.symbol) {
          this.isAvailableEstimated = !updateEvent.isTrueData;
          if (updateEvent.isLP) {
            this.lpBalances[this.asset.symbol] = updateEvent.balance;
          } else {
            this.assetBalances[this.asset.symbol] = updateEvent.balance;
          }
          this.setupAvailable();
          this.$forceUpdate();
        }
      });
    },

    watchExternalTotalStakedUpdate() {
      this.stakedExternalUpdateService.observeExternalTotalStakedUpdate().subscribe((updateEvent) => {
        if (updateEvent.assetSymbol === this.asset.symbol) {
          this.isTotalStakedEstimated = !updateEvent.isTrueData;
          if (updateEvent.action === 'STAKE') {
            this.totalStaked = Number(this.totalStaked) + Number(updateEvent.stakedChange);
          } else if (updateEvent.action === 'UNSTAKE') {
            this.totalStaked = Number(this.totalStaked) - Number(updateEvent.stakedChange);
          }
          this.$forceUpdate();
        }
      });
    },

    watchAssetBalancesDataRefreshEvent() {
      this.dataRefreshEventService.assetBalancesDataRefreshEvent$.subscribe((refreshEvent) => {
        this.assetBalances = refreshEvent.assetBalances;
        this.lpBalances = refreshEvent.lpBalances;
        this.isAvailableEstimated = false;
        this.setupAvailable();
        this.$forceUpdate();
      });
    },

    watchFarmRefreshEvent() {
      this.farmService.observeRefreshFarm().subscribe(async () => {
        this.totalStaked = this.availableFarms.reduce((acc, farm) => acc + parseFloat(farm.totalStaked), 0);
        await this.setupMaxStakingApy();
      });
    },
  },
  watch: {
    noSmartLoan: {
      handler(noSmartLoan) {
        if (noSmartLoan === false) {
          this.setupAvailable();
        }
      },
    }
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.staking-asset-component {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 30px;

  .staking-asset {
    display: flex;
    flex-direction: column;
    width: 100%;
    border-radius: 34px;
    border: 2px solid var(--staking-asset-beta__border-color);

    .staking-asset__header {
      cursor: pointer;
      display: grid;
      grid-template-columns: 22% 1fr 195px 210px 170px 180px 80px;
      height: 60px;
      padding: 0 24px;
      background-color: var(--staking-asset-beta__header-background);
      border-top-left-radius: 32px;
      border-top-right-radius: 32px;
      border-bottom: 2px solid var(--staking-asset-beta__border-color);
      box-sizing: content-box;

      &.body-collapsed {
        border-color: transparent;
        border-radius: 32px;
      }

      &.round-bottom {
        border-radius: 32px;
      }

      .header__cell {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;

        &.cell__asset {
          justify-content: flex-start;
        }

        .header__cell__label {
          display: flex;
          color: var(--staking-asset-beta__header-cell-label-color);
          font-weight: 500;
          margin-right: 5px;
        }

        .header__cell__value {
          font-weight: 500;
        }

        &.cell__max-apy {
          .header__cell__value {
            font-weight: 600;
          }
        }

        &.cell__available {
          width: 230px;
        }

        .asset {
          display: flex;
          flex-direction: row;
          align-items: center;

          .asset__icon {
            width: 22px;
            height: 22px;
            opacity: var(--asset-table-row__icon-opacity);

            &.asset__icon--double {
              margin-right: 20px;
            }
          }

          .asset__info {
            margin-left: 10px;

            .asset__name {
              font-size: $font-size-xsm;
              font-weight: 600;
            }

            .asset__dex {
              font-size: $font-size-xxs;
              color: var(--staking-asset-beta__asset-dex-color);
            }
          }
        }

        .protocols-list {
          display: flex;
          flex-direction: row;

          .protocol__icon {
            opacity: var(--staking-asset-beta__protocol-icon-opacity);
            height: 19px;
            width: 19px;
            border-radius: 50%;

            &:not(:last-child) {
              margin-right: 3px;
            }
          }
        }

        &.cell__action {
          .chevron {
            background: var(--staking-asset-beta__cell-action-chevron-color);
            transition: transform 200ms ease-in-out;

            &:hover {
              background: var(--staking-asset-beta__cell-action-chevron-color--hover);
            }
          }

          &.expanded .chevron {
            transform: rotate(-180deg);
          }
        }
      }
    }

    .staking-protocols {
      height: 0;
      overflow-y: hidden;
      border-bottom-left-radius: 32px;
      border-bottom-right-radius: 32px;
      transition: height 200ms ease-in-out;

      &.expanded {
        height: 233px;
      }

      .compounding__divider {
        background-color: var(--staking-asset-beta__compounding-divider-background);
        display: flex;
        flex-direction: row;
        align-items: center;
        height: 32px;
        padding-left: 26px;
        border-bottom: 2px solid var(--staking-asset-beta__border-color);

        &:not(:first-child) {
          border-top: 2px solid var(--staking-asset-beta__border-color);

        }

        .divider__title {
          display: flex;
          flex-direction: row;
          align-items: center;
          font-size: $font-size-sm;
          font-weight: 500;
          color: var(--staking-asset-beta__divider-title-color);
          margin-right: 6px;
        }
      }

      .protocols__table {
        padding: 24px 20px 0 20px;

        &.protocol__table--no-header {
          padding-top: 0;
        }

        .table__header {
          display: grid;
          grid-template-columns: 23% 1fr 170px 170px 160px 190px 22px;
          padding: 0 6px 9px 6px;

          .table__header__cell {
            display: flex;
            flex-direction: row;
            font-size: $font-size-xsm;
            color: var(--staking-asset-beta__table-header-cell-color);
            font-weight: 500;
            justify-content: flex-end;

            &.asset {
              justify-content: flex-start;
            }

            .info__icon__wrapper {
              transform: translate(3px, -1px);
            }
          }
        }
      }
    }
  }
}

</style>
