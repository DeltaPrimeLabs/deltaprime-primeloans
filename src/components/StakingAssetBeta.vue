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
                by {{ asset.dex }}
              </div>
            </div>
          </div>
        </div>

        <div class="header__cell cell__staked">
          <div class="header__cell__label">Staked:</div>
          <div class="header__cell__value">{{ totalStaked | smartRound }}</div>
        </div>

        <div class="header__cell cell__max-apy">
          <div class="header__cell__label">Max APY:</div>
          <div class="header__cell__value">{{ maxStakingApy | percent }}</div>
        </div>

        <div class="header__cell cell__available">
          <div class="header__cell__label">Available:</div>
          <div class="header__cell__value">{{ formatTokenBalance(balance, 10, true) }}</div>
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
            <div class="table__header__cell">APY</div>
            <div class="table__header__cell">Max. APY</div>
            <div class="table__header__cell">Total interest</div>
            <div class="table__header__cell">Actions</div>
          </div>
          <div class="table__body">
            <StakingProtocolTableRow v-for="(farm, index) in availableFarms"
                                     v-bind:key="index"
                                     :farm="farm"
                                     :asset="asset"
                                     v-on:balanceChange="balanceChange">
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
      maxStakingApy: 0,
      totalStaked: 0,
      availableFarms: [],
      protocolConfig: null,
    };
  },
  mounted() {
    this.setupAvailableProtocols();
    this.setupMaxStakingApy();
    this.setupTotalStaked();
    this.watchExternalAssetBalanceUpdate();
    this.watchExternalTotalStakedUpdate();
  },

  computed: {
    ...mapState('fundsStore', ['smartLoanContract', 'assetBalances', 'lpBalances']),
    ...mapState('serviceRegistry', ['assetBalancesExternalUpdateService', 'totalStakedExternalUpdateService']),
    asset() {
      return config.ASSETS_CONFIG[this.assetSymbol] ? config.ASSETS_CONFIG[this.assetSymbol] : config.LP_ASSETS_CONFIG[this.assetSymbol];
    },
    balance() {
      if (this.asset) {
        if (this.asset.secondary) {
          return this.lpBalances && this.lpBalances[this.assetSymbol];
        } else {
          return this.assetBalances && this.assetBalances[this.assetSymbol];
        }
      } else {
        return 0;
      }
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

    setupMaxStakingApy() {
      this.availableFarms.forEach(async protocol => {
        const apy = await protocol.apy();
        if (apy > this.maxStakingApy) {
          this.maxStakingApy = apy;
        }
      });
    },

    setupTotalStaked() {
      if (this.smartLoanContract) {
        const totalStakedPromises = this.availableFarms.map(farm => farm.staked(this.smartLoanContract.address));
        Promise.all(totalStakedPromises).then((allResults) => {
          this.totalStaked = 0;
          allResults.forEach(result => {
            this.totalStaked += Number(result);
          });
        });
      }
    },

    setupAvailableProtocols() {
      this.availableFarms = config.FARMED_TOKENS_CONFIG[this.assetSymbol];
    },

    protocolLogo(protocol) {
      return config.PROTOCOLS_CONFIG[protocol.protocol].logo;
    },

    balanceChange() {
      this.setupTotalStaked();
    },

    watchExternalAssetBalanceUpdate() {
      this.assetBalancesExternalUpdateService.assetBalanceExternalUpdate$.subscribe((updateEvent) => {
        if (updateEvent.assetSymbol === this.asset.symbol) {
          console.log('staking refresh triggered for: ', updateEvent);
          if (updateEvent.isLP) {
            this.lpBalances[this.asset.symbol] = updateEvent.balance;
          } else {
            this.assetBalances[this.asset.symbol] = updateEvent.balance;
          }
          this.$forceUpdate();
        }
      });
    },

    watchExternalTotalStakedUpdate() {
      this.totalStakedExternalUpdateService.totalStakedExternalUpdate$.subscribe((updateEvent) => {
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
  },
  watch: {
    smartLoanContract: {
      handler(smartLoanContract) {
        if (this) {
          this.setupTotalStaked();
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
          grid-template-columns: 16% 1fr 170px 1fr 180px 120px;
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
          }
        }
      }
    }
  }
}

</style>