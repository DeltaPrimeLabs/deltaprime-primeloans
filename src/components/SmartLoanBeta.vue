<template>
  <div class="smart-loan-beta-component">
    <div class="container">
      <StatsBarBeta></StatsBarBeta>
      <div class="main-content">
        <Block :bordered="true">
          <Tabs>
            <Tab title="Funds">
              <FundsBeta></FundsBeta>
            </Tab>
            <Tab title="Stake">
              stake
            </Tab>
            <Tab title="Provide Liquidity">
              provide liquiditi
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

export default {
  name: 'SmartLoanBeta',
  components: {FundsBeta, Block, StatsBarBeta, Tabs, Tab}
};
</script>

<style lang="scss" scoped>

.main-content {
  margin-top: 30px;
}

</style>