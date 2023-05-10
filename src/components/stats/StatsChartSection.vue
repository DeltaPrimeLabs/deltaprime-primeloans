<template>
  <StatsSection>
    <div class="stats-chart__section">
      <div v-if="!loaded" class="loader">
        <VueLoadersBallBeat color="#A6A3FF" scale="2"></VueLoadersBallBeat>
      </div>
      <template v-if="loaded">
        <div class="toggles">
          <div class="toggle--data">
            <Toggle v-on:change="onDataChange" :options="['PnL', 'Total Value', 'Collateral']"
                    :initial-option="2"></Toggle>
          </div>
          <div class="toggle--metadata">
            <Toggle v-on:change="onPeriodChange" :options="['7 days', '30 days', '1 year']"
                    :initial-option="1"></Toggle>
            <div class="toggle-metadata__separator"></div>
            <Toggle v-on:change="onCurrencyChange" :options="['USD', 'AVAX']"
                    :initial-option="1"></Toggle>
          </div>
        </div>
        <div class="stats-chart-section__chart">
          <LineChart ref="chart" :chart-options="this.chartOptions()" :chart-data="this.chartData()" :theme="theme"></LineChart>
        </div>
      </template>
    </div>
  </StatsSection>
</template>

<script>
import LineChart from "./LineChart.vue";
import StatsSection from "./StatsSection.vue";
import {mapState} from "vuex";
import {getThemeVariable} from "../../utils/style-themes";
import Toggle from "../Toggle.vue";

const mockData = [{"x": 1683510540000, "y": 10}, {"x": 1683511140000, "y": 80}, {
  "x": 1683511740000,
  "y": 10
}, {"x": 1683512340000, "y": 80}, {"x": 1683512940000, "y": 10}, {"x": 1683513540000, "y": 80, event: true}, {
  "x": 1683514140000,
  "y": 10
}];
export default {
  name: "StatsChartSection",
  components: {Toggle, StatsSection, LineChart},
  mounted() {
    this.themeService.observeThemeChange().subscribe(theme => {
      console.error(theme);
      this.onThemeChange(theme)
    });
    setTimeout(() => {
      this.loaded = true
    }, 100)
  },
  computed: {
    ...mapState('serviceRegistry', [
      'themeService',
    ]),

  },
  methods: {
    onThemeChange(theme) {
      this.theme = theme;
      if (this.$refs.chart) {
        setTimeout(() => {
          this.$refs.chart.rerender();
        })
      }
    },
    onDataChange(dataOption) {

    },
    onPeriodChange(periodOption) {

    },
    onCurrencyChange(currencyOption) {

    },
    chartOptions() {
      return {
        height: 256,
        width: 960,
        hover: {
          intersect: false,
          mode: "index",
          animationDuration: 250
        },
        legend: {
          display: false
        },
        maintainAspectRatio: false,
        responsive: true,
        tooltips: {
          custom: (tooltipData) => {
            console.warn(tooltipData);
            if (tooltipData && tooltipData.body && !tooltipData.body[0].lines[0]) {
              tooltipData.opacity = 0;
            }
          },
          enabled: true,
          intersect: false,
          mode: "index",
          backgroundColor: getThemeVariable('--chart__tooltip-background'),
          titleFontFamily: 'Montserrat',
          titleFontColor: getThemeVariable('--chart__tooltip-color'),
          bodyFontColor: getThemeVariable('--chart__tooltip-color'),
          bodyFontFamily: 'Montserrat',
          displayColors: false,
          caretPadding: 6,
          callbacks: {
            label: (tooltipItem, data) => {
              console.log(tooltipItem);
              console.log(data);
              return data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].event ? 'label taki o' : ''
            }
          },
        },
        scales: {
          xAxes: [{
            type: 'time',
            time: {
              displayFormats: {
                day: 'MMM DD',
                hour: 'MMM DD',
                minute: 'MMM DD',
              },
            },
            gridLines: {
              drawOnChartArea: false,
              tickMarkLength: 0,
              lineWidth: 0,
            },
            ticks: {
              backdropPadding: 10,
              beginAtZero: true,
              maxTicksLimit: 1,
              maxRotation: 0,
              minRotation: 0,
              padding: 15,
              fontFamily: 'Montserrat',
              fontColor: getThemeVariable('--stats-chart-section__axes-text-color'),
            }
          }],
          yAxes: [{
            gridLines: {
              lineWidth: 2,
              zeroLineWidth: 0.5,
              borderDash: [8, 4],
              drawOnChartArea: true,
              tickMarkLength: 0,
              drawBorder: false,
              color: getThemeVariable('--stats-chart-section__tick-color'),
            },
            ticks: {
              display: true,
              maxTicksLimit: 1,
              min: 10,
              max: 80 + 0.01 * 80,
              fontFamily: 'Montserrat',
              padding: 10,
              fontColor: getThemeVariable('--stats-chart-section__axes-text-color'),
            }
          }]
        },
      }
    },
    chartData() {
      return {
        datasets: [
          {
            fill: false,
            data: mockData,
            borderWidth: 5,
            pointRadius: [4, 0, 4, 0, 4],
            pointHoverRadius: [4, 0, 4, 0, 4],
            pointBorderWidth: [0, 0, 0, 0, 0],
            pointHoverBorderWidth: [3, 0, 3, 0, 3],
            pointBorderColor: 'transparent',
            pointBackgroundColor: getThemeVariable('--stats-chart-section__point-color'),
            pointHoverBackgroundColor: 'transparent',
            pointHoverBorderColor: getThemeVariable('--stats-chart-section__point-color'),
          }
        ]
      }
    }
  },
  data() {
    return {
      theme: 'DARK',
      totalValue: mockData,
      loaded: false,
    }
  }
}
</script>

<style scoped lang="scss">
.stats-chart__section {
  height: 418px;
  padding: 30px 70px 50px 70px;
}

.stats-chart-section__chart {
  position: relative;
  width: 960px;
  height: 256px;
}
</style>

<style lang="scss">
.stats-chart-section__chart canvas {
  height: 256px !important;
}

.toggles {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 60px;
}

.toggle--metadata {
  display: flex;
  flex-direction: row;
  gap: 16px;
}

.toggle-metadata__separator {
  width: 2px;
  background: var(--stats-chart-section__toggle-metadata-separator-color);
}
</style>
