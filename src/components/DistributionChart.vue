<script>
import {generateChart} from 'vue-chartjs'
import {mapState} from "vuex";
import {getThemeVariable} from "../utils/style-themes";
import Chart from "chart.js";

Chart.defaults.DistributionBarChart = Chart.defaults.bar;
Chart.controllers.DistributionBarChart = Chart.controllers.bar.extend({
  draw: function (ease) {
    Chart.controllers.bar.prototype.draw.call(this, ease);
    if (this.chart.config.options.activeIndex > -1) {
      const activeLineX = this.chart.scales['x-axis-0'].getPixelForTick(this.chart.config.options.activeIndex)
      const LINE_HEIGHT = 18
      const ctx = this.chart.ctx;
      const topY = this.chart.scales['y-axis-0'].top;
      const bottomY = this.chart.scales['y-axis-0'].bottom;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(activeLineX, topY + 4 + LINE_HEIGHT);
      ctx.lineTo(activeLineX, bottomY);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = getThemeVariable('--chart__active-point-line-color');
      ctx.stroke();
      ctx.moveTo(activeLineX, topY)
      ctx.font = '14px Montserrat'
      ctx.textAlign = "center";
      ctx.fillStyle = getThemeVariable('--distribution-chart__ticks-color');
      ctx.fillText('Price', activeLineX, topY - 4)
      ctx.fillText(`$${this.chart.config.options.activePrice.toFixed(4)}`, activeLineX, topY - 4 + LINE_HEIGHT)
    } else {
      const ctx = this.chart.ctx;
      ctx.save();
    }
  }
})

const DistributionBarChart = generateChart('distribution-bar', 'DistributionBarChart')

export default {
  name: "DistributionChart",
  extends: DistributionBarChart,
  props: {
    data: null,
    activeIndex: null,
    activePrice: null,
  },
  mounted() {
    this.rerender();
    this.themeService.observeThemeChange().subscribe(_ => {
      this.chartOptions.scales.xAxes[0].ticks.fontColor = getThemeVariable('--distribution-chart__ticks-color')
      this.chartOptions.scales.yAxes[0].ticks.fontColor = getThemeVariable('--distribution-chart__ticks-color')
      const ctx = this.$refs.canvas.getContext('2d')
      const gradient = ctx.createLinearGradient(0, 0, 280, 0)
      gradient.addColorStop(0.3, getThemeVariable('--distribution-chart__line-background--1'))
      gradient.addColorStop(0.6, getThemeVariable('--distribution-chart__line-background--2'))
      gradient.addColorStop(0.8, getThemeVariable('--distribution-chart__line-background--3'))
      this.chartOptions.scales.yAxes[0].gridLines.zeroLineColor = gradient
      this.rerender();
    });
  },
  methods: {
    rerender() {
      const positiveColor = getThemeVariable('--distribution-chart__bar-color--positive')
      const negativeColor = getThemeVariable('--distribution-chart__bar-color--negative')
      const newData = []
      const newBackgroundColors = this.data.map(({positive}) => positive ? positiveColor : negativeColor)
      const newLabels = []
      this.data.forEach((data, index) => {
        newLabels.push(data.y)
        newData.push({
          x: data.x,
          y: data.y,
          showTick: data.showTick,
        })
      })
      this.chartData.datasets = [{
        data: newData,
        backgroundColor: newBackgroundColors,
      }]
      this.chartData.labels = newLabels
      this.renderChart(this.chartData, this.chartOptions);
    }
  },
  computed: {
    ...mapState('serviceRegistry', ['themeService'])
  },
  data() {
    return {
      theme: 'LIGHT',
      chartData: {
        datasets: [{
          data: [],
          backgroundColor: [],
          borderWidth: 0,
          hoverBackgroundColor: [],
        }],
        labels: []
      },
      chartOptions: {
        layout: {
          padding: {
            top: 18,
            left: 24,
            right: 24,
            bottom: 8,
          }
        },
        activeIndex: this.activeIndex,
        activePrice: this.activePrice,
        height: 256,
        width: 960,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            display: false,
          },
          xAxes: [{
            categoryPercentage: 1.0,
            barPercentage: 0.7,
            barThickness: 2,
            ticks: {
              sampleSize: 2,
              maxTicksLimit: 99999,
              autoSkipPadding: 8,
              fontColor: getThemeVariable('--chart__scales-ticks-color'),
              fontFamily: 'Montserrat',
              maxRotation: 0,
              minRotation: 0,
              userCallback: (item, index) => {
                const barData = this.data[index]
                if (barData.showTick) {
                  return barData.x.toFixed(4)
                }
              }
            },
            gridLines: {
              color: "rgba(0, 0, 0, 0)",
              drawBorder: false,
              drawTicks: true,
              zeroLineWidth: 0
            }
          }],
          yAxes: [{
            ticks: {
              fontColor: getThemeVariable('--chart__scales-ticks-color'),
              maxTicksLimit: 1,
              display: false,
              fontFamily: 'Montserrat',
              beginAtZero: true,
            },
            gridLines: {
              drawTicks: false,
              color: "transparent",
              display: true,
              drawBorder: false,
              zeroLineColor: "#ccc",
              zeroLineWidth: 2
            }
          }]
        },
        tooltips: {
          enabled: false,
          custom: (tooltipModel) => {
          }
        },
        legend: {
          display: false
        },
      }
    }
  },
  watch: {
    tokensData: function () {
      this.rerender();
    },
    chartOptions: () => {
      this.rerender()
    }
  },
}
</script>

<style scoped lang="scss">
</style>
