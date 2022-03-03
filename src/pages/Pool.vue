<template>
  <div class="pool container">
    <Bar>
      <Value label="Your deposits"
        :primary="{value: userDepositBalance, type: 'avax', showIcon: true}"
        :secondary="{value: avaxToUSD(userDepositBalance), type: 'usd'}" />
      <Value label="Current APR"
        :primary="{value: depositRate, type: 'percent'}"/>
      <Value label="All deposits"
        :primary="{value: totalSupply, type: 'avax', showIcon: true}"
        :secondary="{value: avaxToUSD(totalSupply), type: 'usd'}" />
    </Bar>
    <InfoBubble
      cacheKey="DEPOSIT-INFO">
      Deposit your AVAX in a pool and get interest rates. <br/>
      Your deposits will be available for others to borrow.
    </InfoBubble>
    <Block class="block" :bordered="true">
      <div class="overlay" v-if="depositLocked"></div>
      <Tabs>
        <Tab title="Deposit" imgActive="add-deposit-active" img="add-deposit" imgPosition="left" titleWidth="100px">
          <CurrencyForm
            label="Deposit"
            v-on:submitValue="depositValue"
            :waiting="waitingForDeposit"
            flexDirection="column"
            :validators="depositValidators"
          />
        </Tab>
        <Tab title="Withdraw" imgActive="withdraw-deposit-active" img="withdraw-deposit" imgPosition="right" titleWidth="140px">
          <CurrencyForm
            label="Withdraw"
            v-on:submitValue="withdrawValue"
            :waiting="waitingForWithdraw"
            flexDirection="column"
            :max="userDepositBalance"
            :validators="withdrawValidators"
          />
        </Tab>
      </Tabs>
    </Block>
    <Block class="block" background="rgba(255, 255, 255, 0.3)" v-if="(poolEvents && poolEvents.length > 0)">
      <div class="history-title">Deposits history</div>
      <div class="chart-wrapper">
        <Chart :dataPoints="chartPoints" :maxY="maximumDeposit" stepped="before" currencySymbol="AVAX " class="deposit-chart"/>
      </div>
      <PoolHistoryList :items="poolEvents" title="Last deposits" class="history-list"/>
    </Block>
  </div>
</template>

<script>
  import CurrencyForm from "@/components/CurrencyForm.vue";
  import Tabs from "@/components/Tabs.vue";
  import Tab from "@/components/Tab.vue";
  import Value from "@/components/Value.vue";
  import Block from "@/components/Block.vue";
  import Bar from "@/components/Bar.vue";
  import PoolHistoryList from "@/components/PoolHistoryList.vue";
  import InfoBubble from "@/components/InfoBubble.vue";
  import Chart from "@/components/Chart.vue";
  import {mapState, mapActions, mapGetters} from 'vuex';

  export default {
    name: 'Deposit',
    components: {
      CurrencyForm,
      Tabs,
      Tab,
      Value,
      Block,
      Bar,
      PoolHistoryList,
      Chart,
      InfoBubble
    },
    data() {
      return {
        maximumDeposit: 0,
        waitingForDeposit: false,
        waitingForWithdraw: false,
        depositValidators: [
          {
            validate: value => {
              if (value > this.balance) {
                return 'Deposit amount exceeds your account balance';
              }
            }
          }
        ],
        withdrawValidators: [
          {
            validate: value => {
              if (value > this.userDepositBalance) {
                return 'Withdraw amount exceeds your account deposit';
              }
            }
          }
        ]
      }
    },
    computed: {
      ...mapState('pool', ['userDepositBalance', 'depositRate', 'totalSupply', 'poolEvents']),
      ...mapGetters('nft', ['depositLocked']),
      ...mapState('network', ['balance']),
      chartPoints() {
        if (this.poolEvents == null || this.poolEvents.length === 0) {
          return [];
        }

        let currentDeposit = 0;
        let maxDeposit = 0;

        let dataPoints = this.poolEvents.slice().reverse().map(
          (e) => {
            let value = e.type === "Deposit" ? e.value : -e.value;
            currentDeposit += value;

            if (currentDeposit > maxDeposit) maxDeposit = currentDeposit;

            return {
              x: e.time.getTime(),
              y: currentDeposit
            }
          }
        );

        dataPoints.unshift(
            {
              x: dataPoints[0].x - 1,
              y: 0
            }
        )

        dataPoints.push(
          {
            x: Date.now(),
            y: dataPoints.slice(-1)[0].y
          }
        )

        this.maximumDeposit = maxDeposit;

        return dataPoints;
      }
    },
    methods: {
      ...mapActions('pool', ['sendDeposit', 'withdraw']),
      async depositValue(value) {
        this.waitingForDeposit = true;
        this.handleTransaction(this.sendDeposit, {amount: value})
        .then(
          () => {
            this.waitingForDeposit = false;
          }
        );
      },
      async withdrawValue(value) {
        this.waitingForWithdraw = true;
        this.handleTransaction(this.withdraw, {amount: value})
        .then(
          () => {
            this.waitingForWithdraw = false;
          }
        );
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.block, .deposit-chart {
  margin-top: 30px;
}

.history-block {
  padding: 25px 53.5px 20px;
  border-radius: 25px;
  box-shadow: 7px 7px 30px 0 rgba(191, 188, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.3);
}

</style>
<style lang="scss">
@import "~@/styles/variables";

.pool {
  .currency-input-wrapper {
    width: 100%;

    @media screen and (min-width: $md) {
      width: 530px;
    }
  }

  .chart-wrapper {
    width: 100%;
  }
}
</style>
