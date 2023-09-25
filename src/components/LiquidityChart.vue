<script>
import {generateChart} from 'vue-chartjs'
import {mapState} from "vuex";
import {getThemeVariable} from "../utils/style-themes";
import Chart from "chart.js";

Chart.defaults.LiquidityBarChart = Chart.defaults.bar;
Chart.controllers.LiquidityBarChart = Chart.controllers.bar.extend({
  draw: function (ease) {
    Chart.controllers.bar.prototype.draw.call(this, ease);
    const activeLineX = this.chart.scales['x-axis-0'].getPixelForValue(this.chart.config.data.datasets[0].data[this.chart.config.options.currentPriceIndex].x)

    const ctx = this.chart.ctx;
    const topY = this.chart.scales['y-axis-0'].top;
    const bottomY = this.chart.scales['y-axis-0'].bottom;

    console.error(this.chart.config.options.currentPrice);

    // draw line
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(activeLineX, topY + 24);
    ctx.lineTo(activeLineX, bottomY);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = getThemeVariable('--chart__active-point-line-color');
    ctx.stroke();

    ctx.moveTo(activeLineX, topY)
    ctx.font = '14px Montserrat'
    ctx.textAlign = "center";
    ctx.fillStyle = getThemeVariable('--chart__active-point-label-color');
    ctx.fillText(`Active (${this.chart.config.options.currentPrice.toFixed(2)})`, activeLineX, topY + 16)
  }
})

const LiquidityBarChart = generateChart('liquidity-bar', 'LiquidityBarChart')

export default {
  name: "LiquidityChart",
  extends: LiquidityBarChart,
  props: {
    tokensData: null,
    primary: null,
    secondary: null,
    index: null,
    currentPriceIndex: null,
    currentPrice: null,
  },
  mounted() {
    this.rerender();
    this.themeService.observeThemeChange().subscribe(_ => {
      this.chartOptions.scales.xAxes[0].ticks.fontColor = getThemeVariable('--chart__scales-ticks-color')
      this.chartOptions.scales.yAxes[0].ticks.fontColor = getThemeVariable('--chart__scales-ticks-color')
      this.rerender();
    });
  },
  methods: {
    rerender() {
      const newData = []
      const newBackgroundColors = []
      const newHoverColors = []
      const newLabels = []
      this.tokensData.forEach((data, index) => {
        const isPrimaryData = data.primaryTokenBalance > data.secondaryTokenBalance
        newLabels.push(data.price)
        newData.push({
          x: data.price,
          y: data.value,
          token: data,
        })
        newBackgroundColors.push(index === this.currentPriceIndex ? getThemeVariable('--liquidity-chart__active-price-bar-color') : isPrimaryData ? getThemeVariable('--liquidity-chart__main-token-color') : getThemeVariable('--liquidity-chart__secondary-token-color'))
        newHoverColors.push(index === this.currentPriceIndex ? getThemeVariable('--liquidity-chart__active-price-bar-color--hover') : isPrimaryData ? getThemeVariable('--liquidity-chart__main-token-color--hover') : getThemeVariable('--liquidity-chart__secondary-token-color--hover'))
      })
      this.chartData.datasets = [{
        data: newData,
        backgroundColor: newBackgroundColors,
        hoverBackgroundColor: newHoverColors,
        borderWidth: 0,
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
        currentPriceIndex: this.currentPriceIndex,
        currentPrice: this.currentPrice,
        height: 256,
        width: 960,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            display: false,
            beginAtZero: false,
          },
          xAxes: [{
            categoryPercentage: 1.0,
            barPercentage: 0.7,
            ticks: {
              maxTicksLimit: 1,
              fontColor: getThemeVariable('--chart__scales-ticks-color'),
              fontFamily: 'Montserrat',
              maxRotation: 0,
              minRotation: 0,
            },
            gridLines: {
              color: "rgba(0, 0, 0, 0)",
              drawBorder: false
            }
          }],
          yAxes: [{
            ticks: {
              fontColor: getThemeVariable('--chart__scales-ticks-color'),
              maxTicksLimit: 1,
              display: false,
              fontFamily: 'Montserrat',
            },
            gridLines: {
              drawTicks: false,
              drawBorder: false
            }
          }]
        },
        tooltips: {
          enabled: false,
          custom: (tooltipModel) => {
            const tooltipElement = document.getElementById(`chartjs-tooltip-${this.$props.index}`);
            if (tooltipModel.opacity === 0) {
              tooltipElement.style.opacity = '0';
              return;
            }
            const binData = this.tokensData[tooltipModel.dataPoints[0].index]
            const priceText = `<div>Price (${this.primary} / ${this.secondary})</div><div class="value">${binData.price}</div>`
            const primaryTokenText = binData.primaryTokenBalance === '0.0' ? '' : `<div>${this.primary}</div><div class="value">${binData.primaryTokenBalance}</div>`
            const secondaryTokenText = binData.secondaryTokenBalance === '0.0' ? '' : `<div>${this.secondary}</div><div class="value">${binData.secondaryTokenBalance}</div>`
            tooltipElement.innerHTML = priceText + primaryTokenText + secondaryTokenText;
            tooltipElement.classList.remove('above', 'below', 'no-transform');
            if (tooltipModel.yAlign) {
              tooltipElement.classList.add(tooltipModel.yAlign);
            } else {
              tooltipElement.classList.add('no-transform');
            }

            tooltipElement.style.opacity = '1';
            tooltipElement.style.position = 'absolute';
            tooltipElement.style.left = tooltipModel.caretX + 'px';
            tooltipElement.style.top = tooltipModel.caretY + 'px';
            tooltipElement.style.pointerEvents = 'none';
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
