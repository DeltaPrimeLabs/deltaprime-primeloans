<template>
  <div class="smart-loan-beta-component">
    <div class="container">
      <StatsBarBeta :total-value="fullLoanStatus.totalValue" :today-p-n-l="todayValue - yesterdayValue" :ltv="ltv" :profit="1" :profit-percentage="1"></StatsBarBeta>
      <div class="main-content">
        <Block :bordered="true">
          <Tabs>
            <Tab title="Funds">
              <FundsBeta></FundsBeta>
            </Tab>
            <Tab title="Stake">
              <StakeBeta></StakeBeta>
            </Tab>
            <Tab title="Provide Liquidity">
              provide liquidity
            </Tab>
          </Tabs>
        </Block>
      </div>
    </div>
  </div>
</template>

<script>
import StatsBarBeta from './StatsBarBeta';
import Block from './Block';
import Tabs from './Tabs';
import Tab from './Tab';
import FundsBeta from './FundsBeta';
import {mapActions, mapState} from 'vuex';
import StakeBeta from './StakeBeta';
import config from '../config';
import redstone from 'redstone-api';
import {formatUnits} from 'ethers/lib/utils';

export default {
  name: 'SmartLoanBeta',
  components: {StakeBeta, FundsBeta, Block, StatsBarBeta, Tabs, Tab},
  computed: {
    ...mapState('fundsStore', ['ltv', 'assetBalances', 'fullLoanStatus']),
  },
  data() {
    return {
      todayValue: 0,
      yesterdayValue: 0,
    }
  },
  methods: {
    ...mapActions('fundsStore', ['fundsStoreSetup']),
    ...mapActions('poolStore', ['poolStoreSetup']),
    ...mapActions('stakeStore', ['stakeStoreSetup']),

    async assetBalancesChange(balances) {
      let todayValue = 0;
      let yesterdayValue = 0;
      const assets = config.ASSETS_CONFIG;
      const assetSymbols = Object.keys(assets);
      const todayPrices = await redstone.getPrice(assetSymbols);
      const yesterdayPrices = await redstone.getHistoricalPrice(assetSymbols, {date: Date.now() - 1000 * 3600 * 24})
      assetSymbols.forEach((symbol, index) => {
        const balance = formatUnits(balances[index], config.ASSETS_CONFIG[symbol].decimals);
        todayValue += balance * todayPrices[symbol].value;
        yesterdayValue += balance * yesterdayPrices[symbol].value;
      });

      this.todayValue = todayValue;
      this.yesterdayValue = yesterdayValue;

    },
  },
  async mounted() {
    if (window.provider) {
      await this.fundsStoreSetup();
      await this.poolStoreSetup();
      await this.stakeStoreSetup();
    } else {
      setTimeout(async () => {
        await this.fundsStoreSetup();
        await this.poolStoreSetup();
        await this.stakeStoreSetup();
      }, 1000);
    }
  },

  watch: {
    assetBalances: {
      handler(balances) {
        this.assetBalancesChange(balances);
      },
    }
  }
};
</script>

<style lang="scss" scoped>

.main-content {
  margin-top: 30px;
}

</style>