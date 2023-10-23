<template>
  <div id="modal">
    <Modal>
      <div class="header">
        <div class="partner">
          <img class="partner__logo" :src="partner.iconSrc" alt="">
          <div class="partner__name">
            {{ partner.name }}
          </div>
        </div>
        <div class="launch-date">
          Launch date: {{ partner.launchDate }}
        </div>
      </div>

      <div class="description-section">
        {{ partner.introduction }}
      </div>

      <div class="description-section">
        <div class="section-header">Main features:</div>
        <div class="section" v-for="feature of partner.mainFeatures">- {{ feature }}</div>
      </div>

      <div class="description-section description-section--security-measures">
        <div class="section-header">Security measures:</div>
        <div class="security-measures">
          <div class="measure" v-for="measure in partner.securityMeasures">
            <div class="measure__name" v-tooltip="{content: measure.tooltip, classes: 'info-tooltip'}">
              {{ measure.name }}
            </div>
            <DeltaIcon class="measure__state measure__state--enabled" v-if="measure.state === 'ENABLED'"
                       :icon-src="'src/assets/icons/check-simple.svg'" :size="16"></DeltaIcon>
            <DeltaIcon class="measure__state measure__state--disabled" v-if="measure.state === 'DISABLED'"
                       :icon-src="'src/assets/icons/x-simple.svg'" :size="16"></DeltaIcon>
          </div>
        </div>
      </div>

<!--      <div class="description-section">-->
<!--        <div class="section-header">TVL Chart:</div>-->
<!--        <div class="section section&#45;&#45;chart">-->
<!--          <LineChart ref="chart" :chart-options="this.chartOptions()" :chart-data="this.chartData()"-->
<!--                     :theme="theme"></LineChart>-->
<!--        </div>-->
<!--      </div>-->

      <div class="description-section">
        <div class="section-header">Chain impact:</div>
        <div class="section">{{ partner.chainImpact }}</div>
      </div>

      <div class="description-section">
        <div class="section-header">Yield calculation:</div>
        <div class="section">{{ partner.yieldCalculation }}</div>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from "./Modal.vue";
import moment from "moment";
import DeltaIcon from "./DeltaIcon.vue";
import {mapState} from "vuex";
import {getThemeVariable} from "../utils/style-themes";
import LineChart from "./stats/LineChart.vue";

export default {
  name: "PartnerInfoModal",
  components: {LineChart, DeltaIcon, Modal},
  mounted() {
    this.themeService.observeThemeChange().subscribe(theme => {
      this.onThemeChange(theme)
    });
  },
  computed: {
    ...mapState('serviceRegistry', [
      'themeService',
    ]),
  },
  props: {
    partner: null
  },
  data() {
    return {
      theme: 'DARK',
    }
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
    chartOptions() {
      return {
        height: 134,
        width: 550,
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
            if (tooltipData && tooltipData.body && !tooltipData.body[0].lines[0]) {
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
              return `$ ${this.formatTokenBalance(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].y)}`
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
              precision: 4,
              stepSize: 0.001
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
              precision: 4,
              stepSize: 0.001
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
              precision: 4,
              stepSize: 0.001
            },
            ticks: {
              display: true,
              maxTicksLimit: 1,
              min: this.chartMin,
              max: this.chartMax,
              fontFamily: 'Montserrat',
              padding: 10,
              fontColor: getThemeVariable('--stats-chart-section__axes-text-color'),
              precision: 4,
              stepSize: 0.001
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
            data: this.partner.chartData,
            borderWidth: 5,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBorderWidth: 0,
            pointHoverBorderWidth: 3,
            pointBorderColor: 'transparent',
            pointBackgroundColor: getThemeVariable('--stats-chart-section__point-color'),
            pointHoverBackgroundColor: 'transparent',
            pointHoverBorderColor: getThemeVariable('--stats-chart-section__point-color'),
          }
        ]
      }
    }
  }
}
</script>

<style scoped lang="scss">
.partner {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--partner-info-modal__partner-name-color);
  font-size: 30px;
  font-weight: bold;
  margin-bottom: 6px;
}

.partner__logo {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.launch-date {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--partner-info-modal__launch-date-color);
  margin-bottom: 35px;
  text-align: center;
}

.description-section {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--partner-info-modal__description-section-color);
  margin-bottom: 20px;

  &.description-section--security-measures .section-header {
    margin-bottom: 10px;
  }
}

.section--chart {
  height: 134px;
  width: 550px;

  div {
    width: 100%;
    height: 100%;
  }
}

.description-section:first-child {
  margin-bottom: 30px;
}

.section-header {
  font-weight: bold;
  margin-bottom: 4px;
}

.security-measures {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 10px;
}

.measure {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 2px 8px;
  background: var(--partner-info-modal__measure-background-color);
  color: var(--partner-info-modal__measure-color);
  border: var(--partner-info-modal__measure-border);
  border-radius: 6px;
}

.measure__state {
  margin-left: 6px;
}

.measure__state--enabled {
  background: var(--partner-info-modal__measure-state-indicator-color--enabled);
}

.measure__state--disabled {
  background: var(--partner-info-modal__measure-state-indicator-color--disabled);
}

</style>
