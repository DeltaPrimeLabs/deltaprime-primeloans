<template>
  <div class="smart-loan-beta-component">
    <div class="container">
      <StatsBarBeta :total-value="totalValue" :today-p-n-l="1" :ltv="ltv" :profit="1" :profit-percentage="1"></StatsBarBeta>
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

export default {
  name: 'SmartLoanBeta',
  components: {StakeBeta, FundsBeta, Block, StatsBarBeta, Tabs, Tab},
  computed: {
    ...mapState('loan', ['totalValue', 'ltv']),
  },
  methods: {
    ...mapActions('fundsStore', ['fundsStoreSetup']),
    ...mapActions('stakeStore', ['stakeStoreSetup'])
  },
  async mounted() {
    if (window.provider) {
      console.log('provider');
      await this.fundsStoreSetup();
      await this.stakeStoreSetup();
    } else {
      console.log('no provider');

      setTimeout(async () => {
        await this.fundsStoreSetup();
        await this.stakeStoreSetup();
      }, 1000);
    }
  }
};
</script>

<style lang="scss" scoped>

.main-content {
  margin-top: 30px;
}

</style>