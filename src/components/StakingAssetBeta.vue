<template>
  <div v-if="assetSymbol && asset" class="staking-asset-component">
    <div class="staking-asset">
      <div class="staking-asset__header"
           v-bind:class="{'body-collapsed': bodyHasCollapsed, 'round-bottom': stakingHeaderRoundBottom}">
        <div class="header__cell">
          <div class="asset">
            <div class="asset__icon">
              <img :src="logoSrc(asset.symbol)">
            </div>
            <div class="asset__name">
              {{asset.name}}
            </div>
          </div>
        </div>

        <div class="header__cell">
          <div class="header__cell__label">Staked:</div>
          <div class="header__cell__value">{{ totalStaked | smartRound }}</div>
        </div>

        <div class="header__cell">
          <div class="header__cell__label">Max APY:</div>
          <div class="header__cell__value">{{ maxStakingApy | percent }}</div>
        </div>

        <div class="header__cell">
          <div class="header__cell__label">Available protocols:</div>
          <div class="protocols-list">
            <img class="protocol__icon" src="src/assets/logo/yak.svg">
          </div>
        </div>

        <div class="header__cell">
          <img class="chevron" v-bind:class="{'expanded': tableBodyExpanded}" v-on:click="toggleExpanded()"
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
            <div class="table__header__cell">Daily interest</div>
            <div class="table__header__cell">Total interest</div>
            <div class="table__header__cell">Actions</div>
          </div>
          <div class="table__body">
            <StakingProtocolTableRow v-for="protocol in availableProtocols"
                                     v-bind:key="protocol"
                                     :protocol="stakingOptions.protocols[protocol]"
                                     :asset="asset">
            </StakingProtocolTableRow>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import StakingProtocolTableRow from './StakingProtocolTableRow';
import PoolEventsList from './PoolHistoryList';
import config from '@/config';


export default {
  name: 'StakingAssetBeta',
  components: {PoolEventsList, StakingProtocolTableRow},
  props: {
    stakingOptions: {
      required: true,
    },
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
      availableProtocols: null,
      asset: null,
    };
  },
  mounted() {
    this.setupMaxStakingApy();
    this.setupTotalStaked();
    this.setupAvailableProtocols();

    this.asset = config.ASSETS_CONFIG[this.assetSymbol];
  },

  computed: {
    calculateStakingProtocolsHeight() {
      const headerHeight = 53;
      const numberOfProtocols = Object.keys(this.stakingOptions.protocols).length;
      return this.tableBodyExpanded ? `${numberOfProtocols * 60 + headerHeight}px` : 0;
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
      const avaxFarmAddress = '0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95';
      const apysUrl = 'https://staging-api.yieldyak.com/apys';
      fetch(apysUrl).then(response => {
        return response.json();
      }).then(apys => {
        this.maxStakingApy = apys[avaxFarmAddress].apy / 100;
      });
    },

    setupTotalStaked() {
      const protocols = Object.keys(this.stakingOptions.protocols);
      protocols.forEach(protocol => {
        this.totalStaked += this.stakingOptions.protocols[protocol].balance;
      });
    },

    setupAvailableProtocols() {
      this.availableProtocols = Object.keys(this.stakingOptions.protocols);
    }
  }
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
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
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
          }

          .asset__name {
            font-size: $font-size-xsm;
            font-weight: 600;
            margin-left: 10px;
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
          cursor: pointer;
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
          grid-template-columns: 20% repeat(5, 1fr);
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