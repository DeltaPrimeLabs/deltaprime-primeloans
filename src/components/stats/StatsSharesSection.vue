<template>
  <StatsSection>
    <div class="stats-shares__section"
         v-bind:class="{'stats-shares__section--no-data': sharesChartData.datasets[0].data.length === 0}">
      <StatsSectionHeader>
        Portfolio
      </StatsSectionHeader>

      <div v-if="!farms || !assets || !lpAssets || !borrowed" class="loader">
        <VueLoadersBallBeat color="#A6A3FF" scale="2"></VueLoadersBallBeat>
      </div>
      <template v-if="farms && assets && lpAssets && borrowed">
        <Toggle v-on:change="selectedSharesChange" :options="['Farmed', 'LP tokens', 'Held', 'Borrowed', 'Total']"
                :initial-option="2"></Toggle>
        <div v-if="sharesChartData.datasets[0].data.length === 0" class="shares__no-data">
          No Data
        </div>
        <div v-else class="stats-shares-section__content">
          <div class="stats-shares-section__legend-placeholder"></div>
          <div class="stats-shares-section__chart" :class="{'stats-shares-section__chart--active': sharesChartData}">
            <PieChart v-if="selectedDataSet" ref="sharesChart" :chart-data="sharesChartData"
                      :chart-options="sharesChartOptions"></PieChart>
          </div>
          <div class="stats-shares-section__legend">
            <div class="legend__entry" v-for="(share, index) in this.selectedDataSet">
              <div class="entry__circle"
                   :style="{background: colorPalettes[theme][index]}"></div>
              <div class="entry__text" v-if="!share.partials">
                <div class="entry__title">{{ share.asset.name }}</div>
                <div v-if="share.asset.dex" class="entry__subtitle">{{ share.asset.dex }}</div>
                <div class="entry__value">{{ share.percentage }}%</div>
              </div>
              <div class="entry__partials" v-if="share.partials">
                <div class="entry__partial" v-for="(partial, index) in share.partials">
                  <div class="entry__fullname">
                    <div class="entry__title">{{ partial.asset.name }}&nbsp;</div>
                    <div v-if="partial.asset.dex" class="entry__subtitle">{{ partial.asset.dex }}&nbsp;</div>
                  </div>
                  <div class="entry__value">
                    {{ partial.percentage }}%<template v-if="index !== share.partials.length - 1">,</template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </StatsSection>
</template>
<script>
import StatsSectionHeader from './StatsSectionHeader.vue';
import StatsSection from './StatsSection.vue';
import PieChart from './PieChart.vue';
import Toggle from '../Toggle.vue';
import {mapState} from 'vuex';
import config from '../../config';

const COLOR_PALETTES = {
  LIGHT: [
    '#6b70ed',
    '#ff97c9',
    '#ffca7a',
    '#b96ddd',
    '#785eae',
    '#f6c1ff',
    '#c79bff',
  ],
  DARK: [
    '#175c8e',
    '#994796',
    '#fd73b7',
    '#7478d7',
    '#4f58a7',
    '#da85ff',
    '#755ddc',
  ]
};

export default {
  name: 'StatsSharesSection',
  components: {Toggle, PieChart, StatsSection, StatsSectionHeader},
  methods: {
    selectedSharesChange(change) {
      this.selectedShares = change;
      this.switchSharesOnGraph();
    },
    reloadHeld() {
      if (this.assetBalances && this.assets) {
        this.held = this.recalculateShares(
            this.assetBalances,
            (asset) => this.assets[asset].price,
            (asset) => ({name: asset})
        );
        if (this.selectedShares === 'Held') {
          this.switchSharesOnGraph();
        }
      }
    },
    reloadLpTokens() {
      if (this.lpBalances && this.lpAssets) {
        this.lpTokens = this.recalculateShares(
            this.lpBalances,
            (asset) => this.lpAssets[asset].price,
            (asset) => ({
              name: this.lpAssets[asset].name,
              dex: this.lpAssets[asset].dex
            })
        );
        if (this.selectedShares === 'LP tokens') {
          this.switchSharesOnGraph();
        }
      }
    },
    reloadFarms() {
      const farmsBalances = {};
      Object.keys(config.FARMED_TOKENS_CONFIG).forEach((farm) => {
        farmsBalances[farm] = config.FARMED_TOKENS_CONFIG[farm].reduce((acc, farm) => acc + parseFloat(farm.totalStaked), 0);
      });
      if (farmsBalances && this.lpAssets && this.assets && this.farmsLoaded) {
        this.farms = this.recalculateShares(
            farmsBalances,
            (asset) => {
              return this.isAssetLPToken(asset) ? this.lpAssets[asset].price : this.assets[asset].price;
            },
            (asset) => ({
              name: this.isAssetLPToken(asset) ? config.LP_ASSETS_CONFIG[asset].name : asset,
              dex: this.isAssetLPToken(asset) ? config.LP_ASSETS_CONFIG[asset].dex : null
            })
        );
      }
    },
    reloadBorrowed() {
      if (this.debtsPerAsset && this.assets) {
        const debts = {}
        Object.keys(this.debtsPerAsset).forEach(assetKey => {
          debts[assetKey] = this.debtsPerAsset[assetKey].debt
        })
        this.borrowed = this.recalculateShares(
            debts,
            (asset) => this.assets[asset].price,
            (asset) => ({name: asset})
        )
        if (this.selectedShares === 'Borrowed') {
          this.switchSharesOnGraph();
        }
      }
    },
    reloadTotal() {
      if (this.farms && this.lpTokens && this.held) {
        const totalAssets = [];
        let totalBalance = 0;
        let sumPercentage = 0;

        [this.farms, this.lpTokens, this.held].forEach(assetCategory => {
          assetCategory.forEach(asset => {
            totalBalance += asset.balance;
            const foundAssetIndex = totalAssets.findIndex(alreadyAdded => (
                alreadyAdded.asset.name === asset.asset.name
                && (alreadyAdded.asset.dex || null) === (asset.asset.dex || null)
            ))
            if (foundAssetIndex > -1) {
              totalAssets[foundAssetIndex].balance += asset.balance
            } else {
              totalAssets.push({
                asset: {...asset.asset},
                balance: asset.balance,
              });
            }
          })
        })

        const calculatedTotals = totalAssets
            .map((asset, index) => {
              const sharePercentage = index === totalAssets.length - 1
                  ? Math.round((100 - sumPercentage) * 100) / 100
                  : Math.round(asset.balance / totalBalance * 10000) / 100;
              sumPercentage += sharePercentage;
              return {
                ...asset,
                percentage: sharePercentage
              }
            })
            .sort((shareA, shareB) => {
              return shareA.balance < shareB.balance ? 1 : -1;
            });

        this.total = this.mergeToMaxNumberOfAssets(calculatedTotals);
      }
    },
    isAssetLPToken(asset) {
      return Object.keys(this.lpAssets).includes(asset);
    },
    switchSharesOnGraph() {
      const chartDataForShares = {
        'Held': this.held,
        'LP tokens': this.lpTokens,
        'Farmed': this.farms,
        'Borrowed': this.borrowed,
        'Total': this.total,
      };
      this.selectedDataSet = chartDataForShares[this.selectedShares];
      this.sharesChartData.labels = this.selectedDataSet.map(share => share.asset.dex ? `${share.asset.name} ${share.asset.dex}` : share.asset.name);
      this.sharesChartData.datasets[0].data = this.selectedDataSet.map(share => share.balance);
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
          });
          sumBalance += assetBalance;
        }
      }
      updatedShares = updatedShares
          .map((shareData, index) => {
            const sharePercentage = index === updatedShares.length - 1
                ? Math.round((100 - sumPercentage) * 100) / 100
                : Math.round(shareData.balance / sumBalance * 10000) / 100;
            sumPercentage += sharePercentage;
            return {
              ...shareData,
              percentage: sharePercentage
            };
          })
          .sort((shareA, shareB) => {
            return shareA.balance < shareB.balance ? 1 : -1;
          });

      return this.mergeToMaxNumberOfAssets(updatedShares);
    },

    // TODO move to service
    formatTokenBalance(value, precision = 5, toFixed = false) {
      const balanceOrderOfMagnitudeExponent = String(value).split('.')[0].length - 1;
      const precisionMultiplierExponent = precision - balanceOrderOfMagnitudeExponent;
      const precisionMultiplier = Math.pow(10, precisionMultiplierExponent >= 0 ? precisionMultiplierExponent : 0);
      if (value !== null) {
        if (!toFixed) {
          return String(Math.round(value * precisionMultiplier) / precisionMultiplier);
        } else {
          return (Math.round(value * precisionMultiplier) / precisionMultiplier).toFixed(precision).replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, '$1');
        }
      } else {
        return '';
      }
    },
    mergeToMaxNumberOfAssets(assets) {
      if (assets.length > 7) {
        const partials = assets.slice(6, assets.length - 1);
        const mergedShare = [...partials].reduce((merged, current) => {
          return {
            asset: {name: merged.asset.name + `, ${current.asset.name}${current.asset.dex ? ' ' + current.asset.dex : ''}`},
            balance: merged.balance + current.balance,
            percentage: merged.percentage + current.percentage
          };
        });
        mergedShare.partials = [...partials];
        return [...assets.slice(0, 6), mergedShare];
      } else {
        return assets;
      }
    }
  },
  computed: {
    ...mapState('fundsStore', ['assetBalances', 'assets', 'lpAssets', 'lpBalances', 'debtsPerAsset']),
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
    });

    this.farmService.observeRefreshFarm().subscribe(() => {
      this.farmsLoaded = true;
      this.reloadFarms()
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
        this.reloadBorrowed();
      },
      immediate: true
    },
    debtsPerAsset: {
      handler() {
        this.reloadBorrowed();
      }
    },
    held: {
      handler() {
        this.reloadTotal();
      }
    },
    lpTokens: {
      handler() {
        this.reloadTotal();
      }
    },
    farms: {
      handler() {
        this.reloadTotal();
      }
    },
  },
  data() {
    return {
      theme: 'LIGHT',
      farmsLoaded: null,
      selectedDataSet: null,
      held: null,
      borrowed: null,
      total: null,
      lpTokens: null,
      farms: null,
      selectedShares: 'Held',
      colorPalettes: COLOR_PALETTES,
      sharesChartOptions: {
        maintainAspectRatio: true,
        legend: {
          display: false
        },
        tooltips: {
          callbacks: {
            label: (tooltipItem, data) => {
              const value = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index]
              return `${data.labels[tooltipItem.index]}: $ ${this.formatTokenBalance(value)}`
            }
          },
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
    };
  }
};
</script>

<style scoped lang="scss">
@import "~@/styles/variables";

.stats-shares__section {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 70px 130px 60px;

  &.stats-shares__section--no-data {
    padding: 30px 70px 40px 60px;
  }

  .shares__no-data {
    font-size: $font-size-mlg;
    color: var(--stats-shares-section__no-data-text-color);
    font-weight: 500;
    margin-top: 30px;
  }
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
      pointer-events: none;
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
  position: relative;
  display: flex;
  flex-direction: row;
}

.entry__title {
  font-weight: bold;
  margin-right: 10px;
}

.entry__subtitle {
  position: absolute;
  font-weight: normal;
  font-size: $font-size-xs;
  top: 18px;
  color: var(--stats-shares-section__legend-entry-subtitle-color);
}

.entry__fullname {
  .entry__subtitle {
    display: flex;
    flex-direction: column;
    position: initial;
  }
}

.entry__partials {
  position: relative;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;

  .entry__title {
    margin-right: 0;
  }
}

.entry__partial {
  display: flex;
  flex-direction: row;

  .entry__subtitle {
    margin-bottom: 4px;
  }
}

.entry__circle {
  flex-shrink: 0;
  height: 20px;
  width: 20px;
  border-radius: 50%;
  margin-right: 10px;
}

.loader {
  width: 100%;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stats-shares-section__legend-placeholder {
  width: 200px;
}
</style>
