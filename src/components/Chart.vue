<script>
  import Chart from 'chart.js'
  import { generateChart } from 'vue-chartjs'
  import { getThemeVariable } from "../utils/style-themes";
  import {mapState} from "vuex";

  Chart.defaults.LineWithLine = Chart.defaults.line;
  Chart.controllers.LineWithLine = Chart.controllers.line.extend({
    draw: function(ease) {
      Chart.controllers.line.prototype.draw.call(this, ease);

      if (this.chart.tooltip._active && this.chart.tooltip._active.length) {
        var activePoint = this.chart.tooltip._active[0],
        ctx = this.chart.ctx,
        x = activePoint.tooltipPosition().x,
        y = activePoint.tooltipPosition().y,
        topY = this.chart.scales['y-axis-0'].top,
        bottomY = this.chart.scales['y-axis-0'].bottom;

         // draw line
         ctx.save();
         ctx.beginPath();
         ctx.moveTo(x, topY);
         ctx.lineTo(x, bottomY);
         ctx.lineWidth = 1.5;
         ctx.strokeStyle = getThemeVariable('--chart__active-point-line-color');
         ctx.stroke();

        // draw point
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.strokeStyle = getThemeVariable('--chart__active-point-point-color');
        ctx.lineWidth = 2.5;
        ctx.closePath();
        ctx.fillStyle = this.chart.config.data.datasets[0].borderColor;
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
   }
  })

  const CustomLine = generateChart('custom-line', 'LineWithLine')

  export default {
    name: 'Chart',
    extends: CustomLine,
    props: {
      dataPoints: {
        type: Array,
        default: () => [],
      },
      dateFormat: {
        default: 'HH:mm DD/MM/YYYY'
      },
      currencySymbol: {
        default: '$',
        type: String
      },
      minY: 0,
      maxY: null,
      height: null,
      width: null,
      lineWidth: null,
      stepped: false,
      positiveChange: false,
    },
    data() {
      return {
      }
    },
    mounted() {
      this.rerenderChart();
      this.themeService.themeChange$.subscribe(() => {
        this.rerenderChart();
      })
    },
    computed: {
      ...mapState('serviceRegistry', [
        'themeService'
      ]),
      minX() {
        return this.dataPoints[0].x;
      },
      maxX() {
        return this.dataPoints.slice(-1)[0].x;
      },
    },
    watch: {
      dataPoints() {
        this.rerenderChart();
      },
      options() {
        this.rerenderChart();
      }
    },
    methods: {
      options() {
        return {
          aspectRatio: this.isMobile ? 2 : 4,
          height: null,
          width: null,
          legend: {
            display: false
          },
          elements: {
            point:{
              radius: 0
            }
          },
          scales: {
            xAxes: [{
              type: 'time',
              time: {
                displayFormats: {
                  day: 'MMM DD',
                  hour: 'MMM DD',
                  minute: 'MMM DD',
                }
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
                fontColor: getThemeVariable('--chart__scales-ticks-color'),
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
                color: getThemeVariable('--chart__grid-lines-color'),
              },
              ticks: {
                display: true,
                maxTicksLimit: 1,
                min: this.minY,
                max: this.maxY + 0.01 * this.maxY,
                fontFamily: 'Montserrat',
                padding: 10,
                fontColor: getThemeVariable('--chart__scales-ticks-color'),
              }
            }]
          } ,
          tooltips: {
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
                var label = data.datasets[tooltipItem.datasetIndex].label || '';

                if (label) {
                  label += ': ';
                }
                label += tooltipItem.yLabel.toPrecision(6);
                return this.currencySymbol + label;
              }
            }
          }
        }
      },
      chartData() {
        return {
          datasets: [
            {
              fill: false,
              steppedLine: this.stepped,
              data: this.dataPoints,
              borderColor: getThemeVariable(this.positiveChange ? '--chart__line-color--positive' : '--chart__line-color--negative'),
              borderWidth: this.lineWidth
            }
          ]
        };
      },
      rerenderChart() {
        this.renderChart(this.chartData(), this.options());
      }
    }
  }
</script>

<style lang="scss" scoped>
canvas {
  width: 100% !important;
  height: unset !important;
}
</style>

