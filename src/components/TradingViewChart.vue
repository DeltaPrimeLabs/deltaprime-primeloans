<template>
  <div ref="wrapper" class="trading-view__wrapper">
    <div ref="widget" class="tradingview-widget-container">
      <div :id="'tradingview-' + index" class="tradingview-widget-container__widget"></div>
      <div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div>
    </div>
  </div>
</template>

<script>
import {mapState} from "vuex";
import {getThemeVariable} from "../utils/style-themes";

export default {
  name: "TradingViewChart",
  props: {
    tradingViewSymbol: null,
    index: null,
  },
  computed: {
    ...mapState('serviceRegistry', [
      'themeService'
    ]),
  },
  data() {
    return {
      defaultOptions: {
        width: 1090,
        height: 500,
        interval: "D",
        timezone: "Etc/UTC",
        theme: "light",
        style: "1",
        locale: "en",
        enable_publishing: false,
        backgroundColor: "rgba(0, 0, 0, 0)",
        container_id: "tradingview-id"
      }
    }
  },
  mounted() {
    this.themeService.themeChange$.subscribe((theme) => {
      this.rerenderChart({
        backgroundColor: getThemeVariable('--small-block__small-block-background'),
        theme: theme.toLowerCase(),
        container_id: `tradingview-${this.$props.index}`
      });
    })
  },
  methods: {
    rerenderChart(options) {
      const wrapperElementWidth = this.$refs.wrapper.clientWidth
      new window.TradingView.widget({
        symbol: this.$props.tradingViewSymbol,
        width: wrapperElementWidth,
        ...this.defaultOptions,
        ...options,
      });
    }
  }
}
</script>

<style scoped>
</style>
