<script>
import {Pie} from 'vue-chartjs'

export default {
  name: "PieChart",
  extends: Pie,
  mounted() {
    this.rerender();
  },
  methods: {
    rerender() {
      this.renderChart(this.$props.chartData, this.$props.chartOptions);
    }
  },
  props: {
    chartData: null,
    chartOptions: null
  },
  watch: {
    chartData: () => {
      this.rerender()
    },
    chartOptions: () => {
      this.rerender()
    }
  },
}
</script>

<style scoped lang="scss">
</style>
