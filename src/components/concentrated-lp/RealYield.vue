<template>
  <div class="real-yield">
    <div class="real-yield__header">
      <Toggle :options="['APR', 'Weekly']" :size="'big'"></Toggle>
      <div class="real-yield__header-text">
        Choose APR or Weekly data. Select/deselect positions you want to be count into Real Yield
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
            <div class="toggle-row__label">
              <div class="label__part label__part--name">
                {{ row.name }}
              </div>
              <div class="label__part label__part--trend">
                <ColoredValueBeta :value="row.trend" :formatting="'percent'"
                                  :percentage-rounding-precision="2" :font-weight="500"></ColoredValueBeta>
              </div>
              <div class="label__part label__part--value">
                {{ row.value | nonAbsoluteUsd }}
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
            <div class="toggle-row__label">
              <div class="label__part label__part--name">
                {{ row.name }}
              </div>
              <div class="label__part label__part--trend">
                <ColoredValueBeta :value="row.trend" :formatting="'percent'"
                                  :percentage-rounding-precision="2" :font-weight="500"></ColoredValueBeta>
              </div>
              <div class="label__part label__part--value">
                {{ row.value | nonAbsoluteUsd }}
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
          <ColoredValueBeta :value="impermanentLoss.trend" :formatting="'percent'"
                            :percentage-rounding-precision="2" :font-weight="500"></ColoredValueBeta>
          <div class="impermanent-loss__value">
            {{ impermanentLoss.value | nonAbsoluteUsd }}
          </div>
        </div>
        <div class="real-yield-section__border">
          <div class="real-yield-section__content">
            <div class="real-yield-content__title">
              Real Yield
            </div>
            <div class="real-yield-content__data">
              <ColoredValueBeta :value="realYield.trend" :formatting="'percent'"
                                :percentage-rounding-precision="2" :font-weight="600"
                                :font-size="16"></ColoredValueBeta>
              <div class="real-yield-content__data--value">
                {{ realYield.value | nonAbsoluteUsd }}
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

export default {
  name: "RealYield",
  components: {SlideSwitch, ColoredValueBeta, Toggle},
  props: {
    lpToken: null,
  },
  data() {
    return {
      lpTokenDetails: {
        primaryTokenDetails: [
          {
            name: 'Rebalance',
            trend: 0.0234,
            value: 0.35,
            countInRealYield: false,
          },
          {
            name: 'Fees',
            trend: 0.0181,
            value: 0.15,
            countInRealYield: false,
          },
          {
            name: 'PriceChange',
            trend: 0.0354,
            value: 0.48,
            countInRealYield: false,
          },
        ],
        secondaryTokenDetails: [
          {
            name: 'Rebalance',
            trend: 0.0234,
            value: 0.35,
            countInRealYield: false,
          },
          {
            name: 'Fees',
            trend: 0.0181,
            value: 0.15,
            countInRealYield: false,
          },
          {
            name: 'PriceChange',
            trend: 0.0354,
            value: 0.48,
            countInRealYield: false,
          },
        ],
      },
      impermanentLoss: {
        trend: -12,
        value: -0.23,
      },
      realYield: {
        trend: 2,
        value: 3.12,
      }
    }
  },
  mounted() {
    this.recalculateRealYield();
  },
  methods: {
    recalculateRealYield() {
      const newImpermanentLoss = {
        trend: 0,
        value: 0,
      }
      const newRealYield = {
        trend: 0,
        value: 0,
      }
      this.lpTokenDetails.primaryTokenDetails
        .filter(primaryTokenDetail => primaryTokenDetail.countInRealYield)
        .forEach(primaryTokenDetail => {
          newImpermanentLoss.trend -= primaryTokenDetail.trend;
          newRealYield.trend += primaryTokenDetail.trend;
          newImpermanentLoss.value -= primaryTokenDetail.value;
          newRealYield.value += primaryTokenDetail.value;
        })

      this.lpTokenDetails.secondaryTokenDetails
        .filter(secondaryTokenDetail => secondaryTokenDetail.countInRealYield)
        .forEach(secondaryTokenDetail => {
          newImpermanentLoss.trend -= secondaryTokenDetail.trend;
          newRealYield.trend += secondaryTokenDetail.trend;
          newImpermanentLoss.value -= secondaryTokenDetail.value;
          newRealYield.value += secondaryTokenDetail.value;
        })

      this.realYield = newRealYield;
      this.impermanentLoss = newImpermanentLoss;
    }
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
  display: flex;
  flex-direction: row;
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
}

.real-yield-content__data--value {
  font-size: $font-size-sm;
  font-weight: 600;
  margin-left: 6px;
  color: var(--real-yield__label-part-value-color)
}

</style>
