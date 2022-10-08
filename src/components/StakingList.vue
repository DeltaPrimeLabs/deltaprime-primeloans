<template>
  <div class="list">
    <div class="title">Staking</div>
    <div class="total">
        <span class="total-value-wrapper">
          <span class="total-value">
            Total staked: <span class="value">$ {{ getTotalStakedPerProtocol() }}</span>
          </span>
        </span>
    </div>

    <div class="table">
      <div class="staking-asset__header protocols__row">
        <div class="table__cell left">Protocol</div>
        <div class="table__cell right">Total staked</div>
        <div class="table__cell right">Max APY</div>
        <div class="table__cell"></div>
        <div class="table__cell"></div>
        <div class="table__cell right">View</div>
      </div>
      <div class="table__body">
        <div class="table__row protocols__row" v-for="(protocol, protocolKey, index) in protocols"
             v-bind:key="protocolKey">
          <div class="table__cell left" data-label="Pool">
            <div class="token-logo-wrapper">
              <img :src="logoSrc(protocol.symbol)" class="token-logo"/>
            </div>
            <span class="token-name">{{ protocol.name }}</span>
          </div>
          <div class="table__cell value right" data-label="Total Staked">
            <span>$ {{ getTotalStakedPerProtocol() }}</span>
          </div>
          <div class="table__cell right" data-label="Max APY">
            <LoadedValue :check="() => protocol.maxApy !== null" :value="protocol.maxApy | percent"></LoadedValue>
          </div>
          <div class="table__cell" v-if="!isMobile"></div>
          <div class="table__cell" v-if="!isMobile"></div>
          <div>
            <div class="table__cell invest-buttons right" @click.stop>
              <img @click="showStakingOptions(protocolKey)" class="chevron clickable-icon"
                   v-bind:class="{'open': protocol.showStakingOptions}"/>
            </div>
          </div>

          <div class="staking-table" v-if="protocol && protocol.showStakingOptions" @click.stop>
            <div class="staking-options-table">
              <div class="table nested-table">
                <div class="staking-asset__header">
                  <div class="table__cell left">Asset</div>
                  <div class="table__cell right">TVL</div>
                  <div class="table__cell right">APY</div>
                  <div class="table__cell right">Staked</div>
                  <div class="table__cell right">Available</div>
                  <div class="table__cell right"></div>
                  <div class="table__cell right">Stake/Unstake</div>
                </div>
                <div class="table__body">
                  <div class="table__row" v-for="asset in protocol.stakingOptions"
                       v-bind:key="asset.symbol">
                    <div class="table__cell left" data-label="Asset">
                      <div class="token-logo-wrapper">
                        <img :src="logoSrc(asset.symbol)" class="token-logo"/>
                      </div>
                      <span class="token-name">{{ asset.name }}</span>
                    </div>
                    <div class="table__cell value right" data-label="Price">
                      <LoadedValue :check="() => asset.tvl !== null" :value="asset.tvl | usd">M</LoadedValue>
                    </div>
                    <div class="table__cell right" data-label="APY">
                      <LoadedValue :check="() => asset.apy !== null" :value="asset.apy | percent"></LoadedValue>
                    </div>
                    <div class="table__cell right" data-label="Staked">
                      <LoadedValue
                        :check="() => stakedAssets[protocolKey].assets[asset.symbol].balance !== null"
                        :value="formatTokenBalance(stakedAssets[protocolKey].assets[asset.symbol].balance, 4)">
                      </LoadedValue>
                    </div>
                    <div class="table__cell right">
                      <LoadedValue
                        :check="() => asset.balance != null"
                        :value="formatTokenBalance(asset.balance, 4)">
                      </LoadedValue>
                    </div>
                    <div class="table__cell" v-if="!isMobile"></div>
                    <div>
                      <div class="table__cell invest-buttons right" @click.stop>
                        <img class="plus clickable-icon" @click="showStakeForm(protocolKey, asset)"/>
                        <img src="src/assets/icons/slash-small.svg"/>
                        <img class="minus clickable-icon" @click="showUnstakeForm(protocolKey, asset)"/>
                      </div>
                    </div>

                    <div class="staking-currency-input" v-if="asset.showStakeForm">
                      <SmallBlock
                        v-on:close="() => { asset.showStakeForm = false;  }">
                        <CurrencyForm
                          label="Stake"
                          :symbol="asset.symbol"
                          :price="asset.price"
                          :hasSecondButton="true"
                          :flexDirection="isMobile ? 'column' : 'row'"
                          :slim="true"
                          :waiting="asset.transactionInProgress"
                          :validators="stakeValidators()"
                          v-on:submitValue="(value) => stake(protocol, asset, value)"
                        />
                      </SmallBlock>
                    </div>

                    <div class="staking-currency-input" v-if="asset.showUnstakeForm">
                      <SmallBlock
                        v-on:close="() => { asset.showUnstakeForm = false;  }">
                        <CurrencyForm
                          label="Unstake"
                          :symbol="asset.symbol"
                          :price="asset.price"
                          :hasSecondButton="true"
                          :flexDirection="isMobile ? 'column' : 'row'"
                          :slim="true"
                          :max="prepareValueForUnstakeMax(stakedAssets[protocolKey].assets[asset.symbol].balance)"
                          :waiting="asset.transactionInProgress"
                          :validators="unstakeValidators(protocolKey, asset)"
                          v-on:submitValue="(value) => unstake(protocol, asset, value)"
                        />
                      </SmallBlock>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script>
import Chart from '@/components/Chart.vue';
import SimpleChart from '@/components/SimpleChart.vue';
import Block from '@/components/Block.vue';
import CurrencyForm from '@/components/CurrencyForm.vue';
import SmallBlock from '@/components/SmallBlock.vue';
import LoadedValue from '@/components/LoadedValue.vue';
import Button from '@/components/Button.vue';
import {mapState, mapActions, mapGetters} from 'vuex';
import Vue from 'vue';
import config from '@/config';
import {BigNumber} from 'ethers';
import {toWei} from '../utils/calculate';


export default {
  name: 'StakingList',
  components: {
    Chart,
    Block,
    CurrencyForm,
    SimpleChart,
    SmallBlock,
    LoadedValue,
    Button
  },
  props: {},
  computed: {
    ...mapState('loan', ['totalValue', 'assets', 'loanHistory', 'stakedAssets']),
    ...mapGetters('loan', ['getCurrentCollateral', 'getProfit']),
  },
  data() {
    return {
      protocols: {
        'YIELD_YAK': {
          symbol: 'YAK',
          name: 'Yield Yak',
          totalStaked: 0,
          balance: 0,
          maxApy: null,
          showStakingOptions: false,
          stakingOptions: {
            AVAX: config.ASSETS_CONFIG.AVAX,
          }
        }
      },
    };
  },
  mounted() {
    this.getAvaxStakingDetails();
  },
  methods: {
    ...mapActions('loan', ['stakeAvaxYak', 'unstakeAvaxYak']),
    showStakingOptions(protocolKey) {
      if (this.protocols && this.protocols[protocolKey]) {
        Vue.set(this.protocols[protocolKey], 'showStakingOptions', !this.protocols[protocolKey].showStakingOptions);
      }
    },

    showStakeForm(protocolKey, asset) {
      if (this.protocols) {
        Vue.set(this.protocols[protocolKey].stakingOptions[asset.symbol], 'showStakeForm', true);
        Vue.set(this.protocols[protocolKey].stakingOptions[asset.symbol], 'showUnstakeForm', false);
      }
    },

    showUnstakeForm(protocolKey, asset) {
      if (this.protocols) {
        Vue.set(this.protocols[protocolKey].stakingOptions[asset.symbol], 'showUnstakeForm', true);
        Vue.set(this.protocols[protocolKey].stakingOptions[asset.symbol], 'showStakeForm', false);
      }
    },

    stake(protocolKey, asset, amount) {
      Vue.set(asset, 'transactionInProgress', true);
      this.handleTransaction(this.stakeAvaxYak, {amount}).then((result) => {
        Vue.set(asset, 'transactionInProgress', false);
        Vue.set(asset, 'showStakeForm', false);
      });
    },

    unstake(protocolKey, asset, amount) {
      Vue.set(asset, 'transactionInProgress', true);
      this.handleTransaction(this.unstakeAvaxYak, {amount}).then((result) => {
        Vue.set(asset, 'transactionInProgress', false);
        Vue.set(asset, 'showUnstakeForm', false);
      });
    },

    formatTokenBalance(balance) {
      if (balance) {
        return Number(balance.toFixed(4)) === 0 ? '' : balance.toFixed(4);
      } else {
        return '';
      }
    },

    getTotalStakedPerProtocol() {
      if (this.stakedAssets) {
        return this.avaxToUSD(this.stakedAssets.YIELD_YAK.assets.AVAX.balance).toFixed(2);
      }
    },

    stakeValidators() {
      return [
        {
          validate: (value) => {
            if (value > this.assets.AVAX.balance) {
              return 'Value exceeds your available AVAX balance';
            }
          }
        }
      ];
    },

    unstakeValidators(protocolKey, asset) {
      return [
        {
          validate: (value) => {
            const stakedAssetBalance = this.stakedAssets[protocolKey].assets[asset.symbol].balance;
            if (value > stakedAssetBalance) {
              return 'Value exceeds amount of staked asset';
            }
          }
        }
      ];
    },

    prepareValueForUnstakeMax(rawValue) {
      return Math.floor(rawValue * 100000000) / 100000000;
    },

    getAvaxStakingDetails() {
      const avaxFarmAddress = '0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95';
      const apysUrl = 'https://staging-api.yieldyak.com/apys';
      const farmsUrl = 'https://staging-api.yieldyak.com/farms';
      fetch(farmsUrl).then(response => {
        return response.json();
      }).then(farms => {
        const avaxFarm = farms.find(farm => farm.address === avaxFarmAddress);
        let tvlM = this.avaxToUSD(avaxFarm.totalDeposits) / 10 ** 6;
        tvlM = Math.round(tvlM * 100) / 100;
        this.protocols.YIELD_YAK.stakingOptions.AVAX.tvl = tvlM;

        fetch(apysUrl).then(response => {
          return response.json();
        }).then(apys => {
          const avaxApy = apys[avaxFarmAddress].apy / 100;
          this.protocols.YIELD_YAK.stakingOptions.AVAX.apy = avaxApy;
          this.protocols.YIELD_YAK.maxApy = avaxApy;
        });
      });
    }
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.protocols__row {
  grid-template-columns: 2fr repeat(5, 1fr) !important;
}

.list-wrapper {
  @media screen and (max-width: $md) {
    width: 70%;
    min-width: 300px;
  }
}

.list {
  width: 100%;
}

.staking-table {
  grid-column: 1/-1;
}

.nested-table {
  padding: 0 20px;
  margin-top: 0;

  .staking-asset__header {
    margin-bottom: 0;
  }
}

.element {
  padding: 15px 0;
  border-style: solid;
  border-width: 2px 0 0 0;
  border-image-source: linear-gradient(91deg, rgba(223, 224, 255, 0.43), rgba(255, 225, 194, 0.62), rgba(255, 211, 224, 0.79));
  border-image-slice: 1;
  font-weight: 500;

  .row {
    display: flex;
    justify-content: space-between;
  }
}

.title {
  font-size: 24px;
  font-weight: bold;
  width: 100%;
  text-align: center;
}

.total {
  margin-top: 30px;
  width: 100%;
  text-align: center;

  .total-value-wrapper {
    background-image: linear-gradient(117deg, #dfe0ff 39%, #ffe1c2 62%, #ffd3e0 82%);
    border-radius: 25px;
    display: inline-block;
    height: 41px;
    padding: 9px 2px 3px;

    @media screen and (min-width: $md) {
      height: 44px;
      padding: 12px 2px 2px;

    }
  }

  .total-value {
    background: white;
    padding: 10px 2px;
    border-radius: 21px;
    font-size: 14px;

    @media screen and (min-width: $md) {
      font-size: 18px;
      padding: 9px 20px;
    }

    .value {
      font-weight: 500;

      &.red {
        color: $red;
      }
    }

    .vertical-line {
      width: 3px;
      height: 17px;
      margin: 3px 5px 2px 5px;
      border-left: solid 2px #dadada;

      @media screen and (min-width: $md) {
        margin: 3px 18px 2px 19px;
      }
    }
  }
}

.options {
  margin-top: 40px;
}

.chart-icon {
  text-align: right;
  margin-left: 40px;
  display: none;
  cursor: pointer;

  @media screen and (min-width: $md) {
    display: flex;
  }

  img {
    height: 22px;
    margin-left: 5px;
  }
}

.invest-buttons {
  display: flex;
  justify-content: center;

  .plus {
    content: url(../assets/icons/plus.svg);

    &:hover {
      content: url(../assets/icons/hover/plus.svg);
    }
  }

  .minus {
    content: url(../assets/icons/minus.svg);

    &:hover {
      content: url(../assets/icons/hover/minus.svg);
    }
  }

  .chevron {
    transform: rotate(0deg);
    transition: transform .2s ease-in-out;
    content: url(../assets/icons/chevron-down.svg);

    &.open {
      transform: rotate(180deg);
    }
  }
}

.enlarge {
  content: url(../assets/icons/enlarge.svg);

  &:hover {
    content: url(../assets/icons/hover/enlarge.svg);
  }
}

.no-buy {
  margin-right: 30px;
  justify-content: flex-end;
}

.clickable {
  cursor: pointer;
}

.token-logo {
  height: 20px;

  @media screen and (max-width: $md) {
    height: 24px;
  }
}

.token-logo-wrapper {
  display: inline-block;
  width: 30px;
}

.token-name {
  font-weight: 500;
}

.chart, .asset-input {
  display: grid;
  grid-column: 1/-1;
  margin-top: 2rem;
  margin-bottom: 2rem;
  height: 230px;
}

.asset-input {
  display: block;
}

.big-chart {
  width: 86%;
  align-self: center;
}

@media screen and (max-width: $md - 1) {
  .invest-buttons {
    display: inline-block;
    border-bottom: none;
    text-align: start;
  }

  .chart-icon {
    display: none;
  }

  .invest-buttons {
    width: 100%;
    text-align: center;

    @media screen and (min-width: $md) {
      width: 65%;
      text-align: start;
    }
  }

  .asset-input {
    border: none;
    justify-content: center;

    @media screen and (min-width: $md) {
      justify-content: inherit;
    }
  }
}

.chart-loader {
  display: flex;
  justify-content: center;
}

.staking-currency-input {
  grid-column: 1/-1;
  height: 230px;
  margin-top: 2rem;
  margin-bottom: 2rem;
}

</style>

