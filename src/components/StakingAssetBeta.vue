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

        <div class="header__cell cell__available">
          <div class="header__cell__label">Balance:</div>
          <div class="header__cell__value">
            <span v-if="isAvailableEstimated">~</span>{{ formatTokenBalance(available, 10, true) }}
          </div>
        </div>

        <div class="header__cell cell__staked">
          <div class="header__cell__label">Staked:</div>
          <div class="header__cell__value">
            <span v-if="isTotalStakedEstimated">~</span>{{ totalStaked | smartRound(10, true) }}
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

        <div class="header__cell">
          <img class="chevron" v-bind:class="{'expanded': tableBodyExpanded}"
               src="src/assets/icons/chevron-down.svg">
        </div>
      </div>

      <div class="staking-protocols" v-bind:class="{'expanded': tableBodyExpanded}"
           :style="{height: calculateStakingProtocolsHeight}">
        <div class="options__table">
          <div class="table__header">
            <div class="table__header__cell asset">Asset & protocol</div>
            <div class="table__header__cell">Staked</div>
            <div class="table__header__cell">Rewards</div>
            <div class="table__header__cell">Min. APY
              <div class="info__icon__wrapper">
                <img class="info__icon"
                     src="src/assets/icons/info.svg"
                     v-tooltip="{content: minApyTooltip, classes: 'info-tooltip long'}">
              </div>
            </div>
            <div class="table__header__cell">Max. APY
              <div class="info__icon__wrapper">
                <img class="info__icon"
                     src="src/assets/icons/info.svg"
                     v-tooltip="{content: maxApyTooltip, classes: 'info-tooltip long'}">
              </div>
            </div>
            <div class="table__header__cell">Actions</div>
          </div>
          <div class="table__body">
            <StakingProtocolTableRow v-for="(farm, index) in availableFarms"
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
import {calculateMaxApy} from "../utils/calculate";


export default {
  name: 'StakingAssetBeta',
  components: {DoubleAssetIcon, StakingProtocolTableRow},
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
      lpBalances: {}
    };
  },
  mounted() {
    this.setupAvailableProtocols();
    this.setupTotalStaked();
    this.watchExternalAssetBalanceUpdate();
    this.watchExternalTotalStakedUpdate();
    this.watchAssetBalancesDataRefreshEvent();
  },
  computed: {
    ...mapState('fundsStore', ['smartLoanContract', 'noSmartLoan']),
    ...mapState('poolStore', ['pools']),
    ...mapState('serviceRegistry', ['assetBalancesExternalUpdateService', 'totalStakedExternalUpdateService', 'dataRefreshEventService']),
    asset() {
      return config.ASSETS_CONFIG[this.assetSymbol] ? config.ASSETS_CONFIG[this.assetSymbol] : config.LP_ASSETS_CONFIG[this.assetSymbol];
    },
    calculateStakingProtocolsHeight() {
      const headerHeight = 53;
      if (this.availableFarms) {
        const numberOfProtocols = Object.keys(this.availableFarms).length;

        return this.tableBodyExpanded ? `${numberOfProtocols * 60 + headerHeight}px` : 0;
      }
    },

    getTotalStaked() {
      let total = 0;
      this.availableFarms.forEach(protocol => {
        total += protocol.totalStaked;
      });
      return total;
    },

    maxApyTooltip() {
      return `Calculated as:<br>
              0) If borrow APY < farm APY<br>
              1) borrow 4.5x asset with the lowest borrow APY;<br>
              2) swap to get the right tokens;<br>
              3) provide all in this farm.`;
    },
    minApyTooltip() {
      return `Does not take swap fees into account from the pool.`;
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
        const apy = await farm.apy();
        if (apy > maxApy) {
          maxApy = apy;
        }
      }

      this.maxLeveragedApy = calculateMaxApy(this.pools, maxApy);

    },

    setupTotalStaked() {
      if (this.smartLoanContract) {
        const totalStakedPromises = this.availableFarms.map(farm => farm.staked(this.smartLoanContract.address));
        Promise.all(totalStakedPromises).then((allResults) => {
          this.totalStaked = 0;
          allResults.forEach(result => {
            this.totalStaked += parseFloat(result);
          });
        });
      }
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
    },

    protocolLogo(protocol) {
      return config.PROTOCOLS_CONFIG[protocol.protocol].logo;
    },

    stakedChange() {
      this.setupTotalStaked();
      this.isTotalStakedEstimated = false;
    },

    watchExternalAssetBalanceUpdate() {
      this.assetBalancesExternalUpdateService.assetBalanceExternalUpdate$.subscribe((updateEvent) => {
        if (updateEvent.assetSymbol === this.asset.symbol) {
          this.isAvailableEstimated = true;
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
      this.totalStakedExternalUpdateService.totalStakedExternalUpdate$.subscribe((updateEvent) => {
        if (updateEvent.assetSymbol === this.asset.symbol) {
          this.isTotalStakedEstimated = true;
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
  },
  watch: {
    smartLoanContract: {
      handler(smartLoanContract) {
        if (this) {
          this.setupTotalStaked();
        }
      },
    },
    noSmartLoan: {
      handler(noSmartLoan) {
        if (noSmartLoan === false) {
          this.setupAvailable();
        }
      },
    },
    pools: {
      async handler(pools) {
        if (pools) {
          await this.setupMaxStakingApy();
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
    border-radius: 32px;
    border: 2px solid $delta-light;

    .staking-asset__header {
      cursor: pointer;
      display: grid;
      grid-template-columns: 16% 1fr 170px 1fr 180px 120px;
      height: 60px;
      padding: 0 24px;
      background-color: $delta-off-white;
      border-top-left-radius: 32px;
      border-top-right-radius: 32px;
      border-bottom: 2px solid $delta-light;
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
          color: $dark-gray;
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
              color: $medium-gray;
            }
          }
        }

        .protocols-list {
          display: flex;
          flex-direction: row;

          .protocol__icon {
            height: 19px;
            width: 19px;
            border-radius: 50%;

            &:not(:last-child) {
              margin-right: 3px;
            }
          }
        }

        .chevron {
          transition: transform 300ms ease-in-out;

          &.expanded {
            transform: rotate(-180deg);
          }
        }
      }
    }

    .staking-protocols {
      height: 0;
      overflow-y: hidden;
      border-radius: 32px;
      transition: height 200ms ease-in-out;

      &.expanded {
        height: 233px;
      }

      .options__table {
        padding: 24px 20px 0 20px;

        .table__header {
          display: grid;
          grid-template-columns: 23% 1fr 170px 170px 160px 156px 22px;
          padding: 0 6px 9px 6px;

          .table__header__cell {
            display: flex;
            flex-direction: row;
            font-size: $font-size-xsm;
            color: $dark-gray;
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