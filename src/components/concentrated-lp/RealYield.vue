<template>
  <div class="real-yield">
    <div class="real-yield__header">
      <Toggle v-on:change="intervalChange" :options="['Weekly', 'APR']" :size="'big'"></Toggle>
      <div class="real-yield__header-text">
        Choose APR or Weekly data. Select/deselect positions you want to be count into Real Yield.
      </div>
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
                <ColoredValueBeta :value="row.value / lastWeekUserValue * multiplier" :formatting="'percent'"
                                  :percentage-rounding-precision="2" :font-weight="500"></ColoredValueBeta>
              </div>
              <div class="label__part label__part--value">
                {{ row.value * multiplier | nonAbsoluteUsd }}
              </div>
            </div>
            <div class="toggle-row__toggle">
              <SlideSwitch :value.sync="row.countInRealYield" @update:value="recalculateRealYield()"></SlideSwitch>
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
                <ColoredValueBeta :value="row.value / lastWeekUserValue * multiplier" :formatting="'percent'"
                                  :percentage-rounding-precision="2" :font-weight="500"></ColoredValueBeta>
              </div>
              <div class="label__part label__part--value">
                {{ row.value * multiplier | nonAbsoluteUsd }}
              </div>
            </div>
            <div class="toggle-row__toggle">
              <SlideSwitch :value.sync="row.countInRealYield" @update:value="recalculateRealYield()"></SlideSwitch>
            </div>
          </div>

        </div>
      </div>

      <div class="real-yield-section">
        <div class="real-yield-section__header">
          <div class="impermanent-loss__label">
            Impermanent loss
          </div>
          <ColoredValueBeta :value="impermanentLoss / lastWeekUserValue * multiplier" :formatting="'percent'"
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
              <ColoredValueBeta :value="realYield / lastWeekUserValue * multiplier" :formatting="'percent'"
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
import {toWei} from "../../utils/calculate";
import {formatUnits} from "ethers/lib/utils";
import redstone from "redstone-api";
const ethers = require('ethers');
const EthDater = require('ethereum-block-by-date');

export default {
  name: "RealYield",
  components: {SlideSwitch, ColoredValueBeta, Toggle},
  props: {
    lpToken: null
  },

  computed: {
    ...mapState('fundsStore', [
      'concentratedLpBalances',
      'assets',
    ]),
    ...mapState('network', ['provider']),
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
      impermanentLoss: 0,
      realYield: 0,
      lastWeekUserValue: 0.001,
      multiplier: 1,
      interval: 'weekly'
    }
  },
  async mounted() {
    await this.prepareRealYieldData();
    this.recalculateRealYield();
  },
  methods: {
    recalculateRealYield() {
      let newRealYield = 0;
      this.lpTokenDetails.primaryTokenDetails
        .filter(primaryTokenDetail => primaryTokenDetail.countInRealYield)
        .forEach(primaryTokenDetail => {
          newRealYield += primaryTokenDetail.value;
        })

      this.lpTokenDetails.secondaryTokenDetails
        .filter(secondaryTokenDetail => secondaryTokenDetail.countInRealYield)
        .forEach(secondaryTokenDetail => {
          newRealYield += secondaryTokenDetail.value;
        })

      this.realYield = newRealYield;
    },
    async prepareRealYieldData() {
      const abi = ['function getUnderlyingAssets(uint256) public view returns (uint256, uint256)'];
      const poolContract = await new ethers.Contract(this.lpToken.address, abi, provider.getSigner());
      const poolBalance = toWei(this.concentratedLpBalances[this.lpToken.symbol].toString());

      const dater = new EthDater(
          this.provider // ethers provider, required.
      );

      let blockData = await dater.getDate(
          Date.now() - 7 * 24 * 3600 * 1000, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
          true // Block after, optional. Search for the nearest block before or after the given date. By default true.
      );

      const weiBalances = await poolContract.getUnderlyingAssets(poolBalance, {
        blockTag: blockData.block,
      });

      const primaryPreviousBalance = formatUnits(weiBalances[0], this.assets[this.lpToken.primary].decimals);
      const secondaryPreviousBalance = formatUnits(weiBalances[1], this.assets[this.lpToken.secondary].decimals);

      const lastWeekPrices = await redstone.getHistoricalPrice([this.lpToken.primary, this.lpToken.secondary], {date: Date.now() - 7 * 1000 * 3600 * 24});

      this.lastWeekUserValue = primaryPreviousBalance * lastWeekPrices[this.lpToken.primary].value
                              + secondaryPreviousBalance * lastWeekPrices[this.lpToken.secondary].value;

      //TODO: get fees
      // this.lpTokenDetails.primaryTokenDetails[1].value =
      // this.lpTokenDetails.primaryTokenDetails[1].value =
      this.lpTokenDetails.primaryTokenDetails[0].value = (this.lpToken.primaryBalance - primaryPreviousBalance) * this.lpToken.firstPrice - this.lpTokenDetails.primaryTokenDetails[1].value;
      this.lpTokenDetails.secondaryTokenDetails[0].value = (this.lpToken.secondaryBalance - secondaryPreviousBalance) * this.lpToken.secondPrice - this.lpTokenDetails.secondaryTokenDetails[1].value;


      const firstPriceChange = lastWeekPrices[this.lpToken.primary].value - this.lpToken.firstPrice;
      const secondPriceChange = lastWeekPrices[this.lpToken.secondary].value - this.lpToken.secondPrice;
      this.lpTokenDetails.primaryTokenDetails[2].value = this.lpToken.primaryBalance * firstPriceChange;
      this.lpTokenDetails.secondaryTokenDetails[2].value = this.lpToken.secondaryBalance * secondPriceChange;

      this.impermanentLoss = (this.lpTokenDetails.primaryTokenDetails[0].value - this.lpTokenDetails.primaryTokenDetails[1].value
                            + this.lpTokenDetails.secondaryTokenDetails[0].value - this.lpTokenDetails.secondaryTokenDetails[1].value)
                            / (primaryPreviousBalance * this.lpToken.firstPrice
                            + secondaryPreviousBalance * this.lpToken.secondPrice);

    },
    intervalChange(interval) {
      if (interval === 'APR') { this.multiplier = 365 / 7; this.interval = 'projected APR' }
      else { this.multiplier = 1; this.interval = 'weekly' }
    },
  },
}
</script>

<style scoped>
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
