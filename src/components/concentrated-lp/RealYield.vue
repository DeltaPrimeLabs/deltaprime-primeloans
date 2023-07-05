<template>
  <div class="real-yield">
    <div class="real-yield__header">
      <Toggle v-on:change="intervalChange" :options="['Weekly', 'APR']" :size="'big'"></Toggle>
      <div class="real-yield__header-text">
        Choose APR or Weekly data. Select/deselect positions you want to be count into Real Yield.
      </div>
    </div>
    <div class="real-yield__recent-event-text" v-if="recentUserAction">
      There was a recent deposit/withdrawal performed. Yield data will get more accurate within next few days.
    </div>
    <div class="real-yield__content">
      <div class="token-section">
        <div class="token-section__header">
          <img class="token__logo" :src="logoSrc(lpToken.primary)" alt="lpToken.primary">
          <div class="token__name">{{ lpToken.primary }}</div>
        </div>
        <div class="token-section__toggles">
          <div class="toggles__toggle-row" v-for="row in lpTokenDetails.primaryTokenDetails">
            <div class="toggle-row__label" :class="{ 'active': row.countInRealYield }">
              <div class="label__part label__part--name">
                {{ row.name }}
              </div>
              <div class="label__part label__part--trend">
                <ColoredValueBeta :value="row.apr * multiplier" :formatting="'percent'"
                                  :percentage-rounding-precision="2" :font-weight="500"></ColoredValueBeta>
              </div>
              <div class="label__part label__part--value">
                {{ row.value * multiplier | nonAbsoluteUsd }}
              </div>
            </div>
            <div class="toggle-row__toggle">
              <SlideSwitch :value.sync="row.countInRealYield" @update:value="updateYield()"></SlideSwitch>
            </div>
          </div>

        </div>
      </div>

      <div class="token-section">
        <div class="token-section__header">
          <img class="token__logo" :src="logoSrc(lpToken.secondary)" alt="lpToken.primary">
          <div class="token__name">{{ lpToken.secondary }}</div>
        </div>
        <div class="token-section__toggles">

          <div class="toggles__toggle-row" v-for="row in lpTokenDetails.secondaryTokenDetails">
            <div class="toggle-row__label" :class="{ 'active': row.countInRealYield }">
              <div class="label__part label__part--name">
                {{ row.name }}
              </div>
              <div class="label__part label__part--trend">
                <ColoredValueBeta :value="row.apr * multiplier" :formatting="'percent'"
                                  :percentage-rounding-precision="2" :font-weight="500"></ColoredValueBeta>
              </div>
              <div class="label__part label__part--value">
                {{ row.value * multiplier | nonAbsoluteUsd }}
              </div>
            </div>
            <div class="toggle-row__toggle">
              <SlideSwitch :value.sync="row.countInRealYield" @update:value="updateYield()"></SlideSwitch>
            </div>
          </div>

        </div>
      </div>

      <div class="real-yield-section">
        <div class="real-yield-section__header">
          <div class="impermanent-loss__label">
            Impermanent loss
          </div>
          <ColoredValueBeta :value="impermanentLossApr != null ? impermanentLossApr * multiplier : impermanentLossApr" :formatting="'percent'"
                            :percentage-rounding-precision="2" :font-weight="500"></ColoredValueBeta>
          <div class="impermanent-loss__value">
            {{ impermanentLoss * multiplier | nonAbsoluteUsd }}
          </div>
        </div>
        <div class="real-yield-section__border">
          <div class="real-yield-section__content">
            <div class="real-yield-content__title">
              Real Yield <span class="real-yield-content__title-interval">({{interval}})</span>
            </div>
            <div class="real-yield-content__data">
              <ColoredValueBeta :value="realYield != null ? realYield * multiplier : realYield" :formatting="'percent'"
                                :percentage-rounding-precision="2" :font-weight="600"
                                :font-size="16"></ColoredValueBeta>
              <div class="real-yield-content__data--value">
                {{ realYield * multiplier | nonAbsoluteUsd }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Toggle from "../Toggle.vue";
import ColoredValueBeta from "../ColoredValueBeta.vue";
import SlideSwitch from "../SlideSwitch.vue";
import {mapState} from "vuex";
import {fromWei, toWei} from "../../utils/calculate";
import {formatUnits} from "ethers/lib/utils";
import redstone from "redstone-api";
import ApolloClient from "apollo-boost";
import gql from "graphql-tag";
import LoadedValue from "../LoadedValue.vue";
const ethers = require('ethers');
const EthDater = require('ethereum-block-by-date');

export default {
  name: "RealYield",
  components: {LoadedValue, SlideSwitch, ColoredValueBeta, Toggle},
  props: {
    lpToken: null
  },

  computed: {
    ...mapState('fundsStore', [
      'concentratedLpBalances',
      'assets',
      'smartLoanContract'
    ]),
    ...mapState('network', ['provider']),
    firstDecimals() {
      return this.assets[this.lpToken.primary].decimals
    },
    secondDecimals() {
      return this.assets[this.lpToken.secondary].decimals
    }
  },
  data() {
    return {
      lpTokenDetails: {
        primaryTokenDetails: [
          {
            name: 'Rebalance',
            value: 0,
            countInRealYield: true,
          },
          {
            name: 'Fees',
            value: 0,
            countInRealYield: true,
          },
          {
            name: 'Price change',
            value: 0,
            countInRealYield: false,
          },
        ],
        secondaryTokenDetails: [
          {
            name: 'Rebalance',
            value: 0,
            countInRealYield: true,
          },
          {
            name: 'Fees',
            value: 0,
            countInRealYield: true,
          },
          {
            name: 'Price change',
            value: 0,
            countInRealYield: false,
          },
        ],
      },
      impermanentLoss: null,
      impermanentLossApr: null,
      realYield: null,
      multiplier: 1,
      interval: 'weekly',
      recentUserAction: false,
      poolContract: null,
      userEvents: []
    }
  },
  async mounted() {
    this.setupPoolContract();
    await this.setupUserEvents();
    await this.calculateRealYield();
    this.updateYield();
  },
  methods: {
    updateYield() {
      let newRealYield = 0;
      this.lpTokenDetails.primaryTokenDetails
        .filter(primaryTokenDetail => primaryTokenDetail.countInRealYield)
        .forEach(primaryTokenDetail => {
          newRealYield += primaryTokenDetail.apr;
        })

      this.lpTokenDetails.secondaryTokenDetails
        .filter(secondaryTokenDetail => secondaryTokenDetail.countInRealYield)
        .forEach(secondaryTokenDetail => {
          newRealYield += secondaryTokenDetail.apr;
        })

      this.realYield = newRealYield;
    },
    async calculateRealYield() {
      const week = 7 * 24 * 3600 * 1000;
      const lastEvent = this.userEvents[this.userEvents.length - 2];

      if (lastEvent && lastEvent.blockTimestamp > (Date.now() - 2 * 24 * 3600 * 1000) / 1000) {
          this.recentUserAction = true;
      }

      let primaryRebalance = 0;
      let primaryFees = 0;
      let primaryPriceChange = 0;
      let secondaryRebalance = 0;
      let secondaryFees = 0;
      let secondaryPriceChange = 0;
      let primaryRebalanceAprWeighted = 0;
      let primaryFeesAprWeighted = 0;
      let primaryPriceChangeAprWeighted = 0;
      let secondaryRebalanceAprWeighted = 0;
      let secondaryFeesAprWeighted = 0;
      let secondaryPriceChangeAprWeighted = 0;
      let impermanentLoss = 0;
      let impermanentLossAprWeighted = 0;

      for (let i = 0; i < this.userEvents.length - 1; i++) {
        const previousEvent = this.userEvents[i];
        const nextEvent = this.userEvents[i + 1];

        const previousUserBalance = fromWei(await this.poolContract.balanceOf(this.smartLoanContract.address, {
          blockTag: (await this.getBlockForTimestamp(previousEvent.blockTimestamp * 1000)).block,
        }));

        const previousVaultPrice = (await redstone.getHistoricalPrice(this.lpToken.symbol, {date: previousEvent.blockTimestamp * 1000})).value;

        this.previousUserValue = previousUserBalance * previousVaultPrice;

        const yieldData = await this.getUserDataForInterval(previousEvent.blockTimestamp * 1000, nextEvent.blockTimestamp * 1000);

        primaryRebalance += yieldData.primaryRebalance;
        primaryFees += yieldData.primaryFees;
        primaryPriceChange += yieldData.primaryPriceChange;

        secondaryRebalance += yieldData.secondaryRebalance;
        secondaryFees += yieldData.secondaryFees;
        secondaryPriceChange += yieldData.secondaryPriceChange;

        impermanentLoss += yieldData.impermanentLoss;

        const interval = nextEvent.blockTimestamp - previousEvent.blockTimestamp;

        if (this.previousUserValue > 0) {
          primaryRebalanceAprWeighted += yieldData.primaryRebalance / this.previousUserValue * interval;
          primaryFeesAprWeighted += yieldData.primaryFees / this.previousUserValue * interval;
          primaryPriceChangeAprWeighted += yieldData.primaryPriceChange / this.previousUserValue * interval;

          secondaryRebalanceAprWeighted += yieldData.secondaryRebalance / this.previousUserValue * interval;
          secondaryFeesAprWeighted += yieldData.secondaryFees / this.previousUserValue * interval;
          secondaryPriceChangeAprWeighted += yieldData.secondaryPriceChange / this.previousUserValue * interval;

          impermanentLossAprWeighted += yieldData.impermanentLoss / this.previousUserValue * interval;
        }
      }

      const primaryRebalanceApr = primaryRebalanceAprWeighted / (week / 1000);
      const primaryFeesApr = primaryFeesAprWeighted / (week / 1000);
      const primaryPriceChangeApr = primaryPriceChangeAprWeighted / (week / 1000);

      const secondaryRebalanceApr = secondaryRebalanceAprWeighted / (week / 1000);
      const secondaryFeesApr = secondaryFeesAprWeighted / (week / 1000);
      const secondaryPriceChangeApr = secondaryPriceChangeAprWeighted / (week / 1000);

      const impermanentLossApr = impermanentLossAprWeighted / (week / 1000);

      this.lpTokenDetails.primaryTokenDetails[0].value = primaryRebalance;
      this.lpTokenDetails.primaryTokenDetails[0].apr = primaryRebalanceApr;
      this.lpTokenDetails.primaryTokenDetails[1].value = primaryFees;
      this.lpTokenDetails.primaryTokenDetails[1].apr = primaryFeesApr;
      this.lpTokenDetails.primaryTokenDetails[2].value = primaryPriceChange;
      this.lpTokenDetails.primaryTokenDetails[2].apr = primaryPriceChangeApr;

      this.lpTokenDetails.secondaryTokenDetails[0].value = secondaryRebalance;
      this.lpTokenDetails.secondaryTokenDetails[0].apr = secondaryRebalanceApr;
      this.lpTokenDetails.secondaryTokenDetails[1].value = secondaryFees;
      this.lpTokenDetails.secondaryTokenDetails[1].apr = secondaryFeesApr;
      this.lpTokenDetails.secondaryTokenDetails[2].value = secondaryPriceChange;
      this.lpTokenDetails.secondaryTokenDetails[2].apr = secondaryPriceChangeApr;

      console.log('this.lpTokenDetails')
      console.log(this.lpTokenDetails)

      this.impermanentLoss = impermanentLoss;
      this.impermanentLossApr = impermanentLossApr;
    },
    async setupPoolContract() {
      const abi = [
        'function getUnderlyingAssets(uint256) public view returns (uint256, uint256)',
        'function balanceOf(address) public view returns (uint256)',
        'function totalSupply() public view returns (uint256)',
      ];
      this.poolContract = await new ethers.Contract(this.lpToken.address, abi, provider.getSigner());
    },
    async getBlockForTimestamp(timestamp) {
      const dater = new EthDater(
          this.provider // ethers provider, required.
      );

      return await dater.getDate(
          timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
          true // Block after, optional. Search for the nearest block before or after the given date. By default true.
      );
    },
    async setupUserEvents() {
      const startBlockTimestamp = parseInt(((Date.now() - 7 * 24 * 3600 * 1000) / 1000).toString());
      const endBlockTimestamp = parseInt((Date.now() / 1000).toString());

      this.userEvents.push({blockTimestamp: startBlockTimestamp}, {blockTimestamp: endBlockTimestamp});

      let query = `{
        deposits(where: { and: [ {vault_: { id: "${this.lpToken.address}"}},  {user: "${this.smartLoanContract.address}"}, {blockTimestamp_gte:${startBlockTimestamp}}]}) {
          id
          user
          vault {
            id
          }
          amountX
          amountY
          blockTimestamp
        }
        withdraws(where: { and: [ {vault_: { id: "${this.lpToken.address}"}},  {user: "${this.smartLoanContract.address}"}, {blockTimestamp_gte:${startBlockTimestamp}}]}) {
          id
          user
          vault {
            id
          }
          amountX
          amountY
          blockTimestamp
        }
      }`;

      const client = new ApolloClient({
        uri: "https://api.thegraph.com/subgraphs/name/0xsirloin/steakhutlb"
      });

      client.query({query: gql(query)}).then(
          resp => {
            this.userEvents.push(...resp.data.deposits);
            this.userEvents.push(...resp.data.withdraws);
            this.userEvents.sort((a, b) => a.blockTimestamp - b.blockTimestamp);
          }
      )
    },
    async getUserDataForInterval(startTimestamp, endTimestamp) {
      const poolBalance = toWei(this.concentratedLpBalances[this.lpToken.symbol].toString());

      const startPrices = await redstone.getHistoricalPrice([this.lpToken.primary, this.lpToken.secondary], {date: startTimestamp});
      const endPrices = await redstone.getHistoricalPrice([this.lpToken.primary, this.lpToken.secondary], {date: endTimestamp});

      const dater = new EthDater(
          this.provider // ethers provider, required.
      );

      let startBlockData = await dater.getDate(
          startTimestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
          true // Block after, optional. Search for the nearest block before or after the given date. By default true.
      );
      let endBlockData = await dater.getDate(
          endTimestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
          true // Block after, optional. Search for the nearest block before or after the given date. By default true.
      );

      const weiStartBalances = await this.poolContract.getUnderlyingAssets(poolBalance, {
        blockTag: startBlockData.block,
      });

      const weiEndBalances = await this.poolContract.getUnderlyingAssets(poolBalance, {
        blockTag: endBlockData.block,
      });

      const primaryStartBalance = formatUnits(weiStartBalances[0], this.assets[this.lpToken.primary].decimals);
      const secondaryStartBalance = formatUnits(weiStartBalances[1], this.assets[this.lpToken.secondary].decimals);

      const primaryEndBalance = formatUnits(weiEndBalances[0], this.assets[this.lpToken.primary].decimals);
      const secondaryEndBalance = formatUnits(weiEndBalances[1], this.assets[this.lpToken.secondary].decimals);

      const harvests = this.lpToken.harvests.filter(
          harvest => harvest.blockTimestamp >= startTimestamp / 1000 && harvest.blockTimestamp < endTimestamp / 1000);

      let primaryFees = 0;
      let secondaryFees = 0;

      for (let harvest of harvests) {
        const userBalance = fromWei(await this.poolContract.balanceOf(this.smartLoanContract.address, {
          blockTag: startBlockData.block,
        }));
        const totalSupply = fromWei(await this.poolContract.totalSupply({
          blockTag: startBlockData.block,
        }));

        const userShare = userBalance / totalSupply;
        primaryFees += (formatUnits(harvest.amountX, this.firstDecimals) - formatUnits(harvest.amountXBefore, this.firstDecimals)) * userShare;
        secondaryFees += (formatUnits(harvest.amountY, this.secondDecimals) - formatUnits(harvest.amountYBefore, this.secondDecimals)) * userShare;
      }

      const result = {};

      result.primaryFees = primaryFees / endPrices[this.lpToken.primary].value;
      result.secondaryFees = secondaryFees / endPrices[this.lpToken.secondary].value;

      result.primaryRebalance = (primaryEndBalance - primaryStartBalance) * endPrices[this.lpToken.primary].value - result.primaryFees;
      result.secondaryRebalance = (secondaryEndBalance - secondaryStartBalance) * endPrices[this.lpToken.secondary].value - result.secondaryFees;

      const firstPriceChange = endPrices[this.lpToken.primary].value - startPrices[this.lpToken.primary].value;
      const secondPriceChange = endPrices[this.lpToken.secondary].value - startPrices[this.lpToken.secondary].value;

      result.primaryPriceChange = primaryEndBalance * firstPriceChange;
      result.secondaryPriceChange = secondaryEndBalance * secondPriceChange;

      result.impermanentLoss = (result.primaryRebalance - result.primaryFees
              + result.secondaryRebalance - result.secondaryFees)
          / (primaryStartBalance * endPrices[this.lpToken.primary].value
              + secondaryStartBalance * endPrices[this.lpToken.secondary].value);


      return result;
    },
    intervalChange(interval) {
      if (interval === 'APR') { this.multiplier = 365 / 7; this.interval = 'projected APR' }
      else { this.multiplier = 1; this.interval = 'weekly' }
    },
  },
}
</script>

<style scoped lang="scss">
@import "~@/styles/variables";

.real-yield {
  padding: 9px 34px 26px 34px;
}

.real-yield__header {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.real-yield__header-text {
  margin-left: 20px;
  color: var(--real-yield__header-text-color);
}

.real-yield__recent-event-text {
  margin-top: 20px;
}

.real-yield__content {
  margin-top: 30px;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 50px;
}

.token-section__header {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.token__logo {
  height: 22px;
  width: 22px;
  filter: drop-shadow(1.36364px 0px 3px rgba(44, 0, 169, 0.1));
  opacity: var(--real-yield__token-logo-opacity);
}

.token__name {
  margin-left: 8px;
  font-size: $font-size-sm;
  font-weight: bold;
}

.token-section__toggles {
  margin-top: 4px;
}

.toggles__toggle-row {
  width: 311px;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;

  &:not(:last-child) {
    padding-bottom: 10px;

    &:before {
      content: '';
      position: absolute;
      bottom: 0;
      height: 1px;
      width: 100%;
      background-image: var(--real-yield__toggle-row-divider-background);
    }
  }
}

.toggle-row__label {
  opacity: 50%;
  display: flex;
  flex-direction: row;

  &.active {
    opacity: 100%;
  }
}

.label__part {
  font-weight: 500;
}

.label__part--name {
  margin-right: 6px;
}

.label__part--value {
  margin-left: 6px;
  color: var(--real-yield__label-part-value-color);
}

.real-yield-section {
  flex-grow: 1;
}

.real-yield-section__header {
  display: flex;
  flex-direction: row;
  font-weight: 500;
  margin-bottom: 6px;
}

.impermanent-loss__label {
  margin-right: 6px;
}

.impermanent-loss__value {
  color: var(--real-yield__label-part-value-color);
  margin-left: 6px;
}

.real-yield-section__border {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  background: var(--real-yield__real-yield-section-content-border);
  padding: 1px;
}


.real-yield-section__content {
  padding: 16px 24px;
  background: var(--real-yield__real-yield-section-content-background);
  border-radius: 9px;
}

.real-yield-content__data {
  display: flex;
  flex-direction: row;
}

.real-yield-content__title {
  font-size: $font-size-sm;
  font-weight: 700;
  margin-bottom: 6px;

  .real-yield-content__title-interval {
    font-weight: 500;
  }
}

.real-yield-content__data--value {
  font-size: $font-size-sm;
  font-weight: 600;
  margin-left: 6px;
  color: var(--real-yield__label-part-value-color)
}

</style>
