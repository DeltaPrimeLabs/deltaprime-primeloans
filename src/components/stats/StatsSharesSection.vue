<template>
  <StatsSection>
    <div class="stats-shares-section">
      <StatsSectionHeader>
        Portfolio
      </StatsSectionHeader>

      <Toggle v-on:change="selectedSharesChange" :options="['Farmed', 'LP tokens', 'Held']"
              :initial-option="2"></Toggle>
      <div class="stats-shares-section__content">
        <div class="stats-shares-section__chart" :class="{'stats-shares-section__chart--active': sharesChartData}">
          <PieChart v-if="this.held" ref="sharesChart" :chart-data="sharesChartData"
                    :chart-options="sharesChartOptions"></PieChart>
        </div>
        <div class="stats-shares-section__legend">
          <div class="legend__entry" v-for="(share, index) in this.selectedDataSet">
            <div class="entry__circle"
                 :style="{background: colorPalettes[theme][index]}"></div>
            <div class="entry__text" v-if="!share.partials">
              <div class="entry__title">{{ share.asset }}</div>
              <div class="entry__value">{{ share.percentage }}%</div>
            </div>
            <div class="entry__partials" v-if="share.partials">
              <template v-for="(partial, index) in share.partials">
                <div class="entry__title">{{ partial.asset }}&nbsp;</div>
                <div class="entry__value">{{ partial.percentage }}%</div>
                <template v-if="index !== share.partials.length - 1">,&nbsp;</template>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </StatsSection>
</template>
<script>
import StatsSectionHeader from "./StatsSectionHeader.vue";
import StatsSection from "./StatsSection.vue";
import PieChart from "./PieChart.vue";
import Toggle from "../Toggle.vue";
import {mapState} from "vuex";
import config from "../../config";

const COLOR_PALETTES = {
  LIGHT: [
    '#c79bff',
    '#6b70ed',
    '#ffca7a',
    '#ff97c9',
    '#785eae',
    '#b96ddd',
    '#f6c1ff',
  ],
  DARK: [
    '#dcaf5b',
    '#c5608c',
    '#7963e1',
    '#dbde7a',
    '#ff8cd0',
    '#c4c400',
    '#67ffe1',
  ]
}

export default {
  name: "StatsSharesSection",
  components: {Toggle, PieChart, StatsSection, StatsSectionHeader},
  methods: {
    selectedSharesChange(change) {
      this.selectedShares = change;
      this.switchSharesOnGraph();
    },
    reloadHeld() {
      if (this.assetBalances && this.assets) {
        this.held = this.recalculateShares(this.assetBalances, (asset) => this.assets[asset].price, (asset) => asset);
        if (this.selectedShares === 'Held') {
          this.switchSharesOnGraph();
        }
      }
    },
    reloadLpTokens() {
      if (this.lpBalances && this.lpAssets) {
        this.lpTokens = this.recalculateShares(this.lpBalances, (asset) => this.lpAssets[asset].price, (asset) => `${this.lpAssets[asset].name} ${this.lpAssets[asset].dex}`)
        if (this.selectedShares === 'LP tokens') {
          this.switchSharesOnGraph();
        }
      }
    },
    reloadFarms() {
      const farmsBalances = {};
      Object.keys(config.FARMED_TOKENS_CONFIG).forEach((farm) => {
        console.warn(config.FARMED_TOKENS_CONFIG[farm][0].totalStaked);
        farmsBalances[farm] = config.FARMED_TOKENS_CONFIG[farm].reduce((acc, farm) => acc + parseFloat(farm.totalStaked), 0);
      })
      if (farmsBalances && this.lpAssets && this.assets && this.farmsLoaded) {
        this.farms = this.recalculateShares(
            farmsBalances,
            (asset) => {
              return this.isAssetLPToken(asset) ? this.lpAssets[asset].price : this.assets[asset].price
            },
            (asset) => this.isAssetLPToken(asset) ? `${config.LP_ASSETS_CONFIG[asset].name} ${config.LP_ASSETS_CONFIG[asset].dex}` : asset
        )
      }
    },
    isAssetLPToken(asset) {
      return Object.keys(this.lpAssets).includes(asset)
    },
    switchSharesOnGraph() {
      const chartDataForShares = {
        'Held': this.held,
        'LP tokens': this.lpTokens,
        'Farmed': this.farms,
      }
      this.selectedDataSet = chartDataForShares[this.selectedShares]
      this.sharesChartData.labels = this.selectedDataSet.map(share => share.asset)
      this.sharesChartData.datasets[0].data = this.selectedDataSet.map(share => share.balance)
      if (this.$refs.sharesChart) {
        this.$refs.sharesChart.rerender();
      }
    },
    recalculateShares(assetsBalances, priceCallback, nameCallback) {
      let updatedShares = [];
      let sumBalance = 0;
      let sumPercentage = 0;
      for (const asset in assetsBalances) {
        const assetBalance = assetsBalances[asset] * priceCallback(asset);
        if (assetBalance !== 0) {
          updatedShares.push({
            asset: nameCallback(asset),
            balance: assetBalance,
          })
          sumBalance += assetBalance
        }
      }
      updatedShares = updatedShares
          .map((shareData, index) => {
            const sharePercentage = index === updatedShares.length - 1
                ? Math.round((100 - sumPercentage) * 100) / 100
                : Math.round(shareData.balance / sumBalance * 10000) / 100
            sumPercentage += sharePercentage
            return {
              ...shareData,
              percentage: sharePercentage
            }
          })
          .sort((shareA, shareB) => {
            return shareA.balance < shareB.balance ? 1 : -1
          })

      if (updatedShares.length > 7) {
        const partials = updatedShares.slice(6, updatedShares.length - 1)
        const mergedShare = [...partials].reduce((merged, current) => {
          return {
            asset: merged.asset + `, ${current.asset}`,
            balance: merged.balance + current.balance,
            percentage: merged.percentage + current.percentage
          }
        })
        mergedShare.partials = [...partials]

        return [...updatedShares.slice(0, 6), mergedShare];
      } else {
        return updatedShares;
      }
    }
  },
  computed: {
    ...mapState('fundsStore', ['assetBalances', 'assets', 'lpAssets', 'lpBalances']),
    ...mapState('serviceRegistry', [
      'themeService',
      'farmService'
    ]),
  },
  mounted() {
    this.themeService.observeThemeChange().subscribe(theme => {
      this.theme = theme;
      this.sharesChartData.datasets[0].backgroundColor = COLOR_PALETTES[theme];
      if (this.$refs.sharesChart) {
        this.$refs.sharesChart.rerender();
      }
    })

    this.farmService.observeRefreshFarm().subscribe(() => {
      if (config.FARMED_TOKENS_CONFIG.AVAX[0].totalStaked) {
        this.farmsLoaded = true;
        this.reloadFarms()
      }
    })
  },
  watch: {
    assetBalances: {
      handler() {
        this.reloadHeld();
        this.reloadFarms();
      },
      immediate: true
    },
    lpBalances: {
      handler() {
        this.reloadLpTokens();
        this.reloadFarms();
      },
      immediate: true
    },
    assets: {
      handler() {
        this.reloadHeld();
      },
      immediate: true
    }
  },
  data() {
    return {
      theme: 'LIGHT',
      farmsLoaded: null,
      selectedDataSet: null,
      held: null,
      lpTokens: null,
      farms: null,
      selectedShares: 'Held',
      colorPalettes: COLOR_PALETTES,
      sharesChartOptions: {
        maintainAspectRatio: true,
        legend: {
          display: false
        }
      },
      sharesChartData: {
        labels: [],
        datasets: [
          {
            data: [],
            borderWidth: 0,
            borderColor: 'transparent',
            backgroundColor: COLOR_PALETTES['LIGHT'],
          }
        ]
      }
    }
  }
}
</script>

<style scoped lang="scss">
.stats-shares-section {
  height: 100%;
  width: 680px;
  display: flex;
  flex-direction: column;
  padding: 30px 70px 130px 60px;
}

.stats-shares-section__content {
  flex-grow: 1;
  display: flex;
  flex-direction: row;
  gap: 32px;
  margin-top: 68px;
}

.stats-shares-section__legend {
  flex-shrink: 0;
}

.stats-shares-section__chart {
  width: 300px;
  height: 300px;
  position: relative;

  &.stats-shares-section__chart--active {
    &:before {
      content: '';
      inset: 0;
      border-radius: 50%;
      box-shadow: var(--stats-shares-section__chart-box-shadow);
      position: absolute;
    }
  }
}

.stats-shares-section__legend {
  width: 200px;
}

.legend__entry {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  color: var(--stats-shares-section__legend-entry-color);
  font-size: 15px;
  line-height: 1.3;
  letter-spacing: -0.3px;

  &:not(:last-child) {
    margin-bottom: 24px;
  }
}

.entry__text {
  display: flex;
  flex-direction: row;
}

.entry__title {
  font-weight: bold;
  margin-right: 10px;
}

.entry__partials {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  .entry__title {
    margin-right: 0;
  }
}

.entry__circle {
  flex-shrink: 0;
  height: 20px;
  width: 20px;
  border-radius: 50%;
  margin-right: 10px;
}
</style>
