<template>
  <div class="pool container">
    <Bar>
      <div>
        <div class="rate-wrapper">
          Current APY: <span class="rate">{{depositRate | percent}}</span>
        </div>
      </div>
      <div class="stats">
        <Value label="Your deposits"
               :primary="{value: userDepositBalance, type: 'avax', showIcon: true}"
               :secondary="{value: avaxToUSD(userDepositBalance), type: 'usd'}" />
        <Value label="Your profit"
               :primary="{value: depositInterest, type: 'avax', showIcon: true, arg: 5}"
               :secondary="{value: avaxToUSD(depositInterest), type: 'usd', arg: 5}" />
        <Value label="All deposits"
               :primary="{value: totalSupply, type: 'avax', showIcon: true}"
               :secondary="{value: avaxToUSD(totalSupply), type: 'usd'}" />
      </div>
    </Bar>
    <InfoBubble
      v-if="depositLocked"
      cacheKey="DEPOSIT-LOCKED">
        Depositing will soon be available!
    </InfoBubble>
    <InfoBubble
        v-if="!depositLocked"
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
            v-on:submitValue="handleDeposit"
            :waiting="waitingForDeposit"
            :defaultValue="depositValue"
            flexDirection="column"
            :validators="depositValidators"
          />
        </Tab>
        <Tab title="Withdraw" imgActive="withdraw-deposit-active" img="withdraw-deposit" imgPosition="right" titleWidth="140px">
          <CurrencyForm
            label="Withdraw"
            v-on:submitValue="handleWithdraw"
            :waiting="waitingForWithdraw"
            :defaultValue="withdrawValue"
            flexDirection="column"
            :max="userDepositBalance"
            :validators="withdrawValidators"
          />
        </Tab>
      </Tabs>
    </Block>
    <Block class="block history-block" background="rgba(255, 255, 255, 0.3)" v-if="(poolEvents && poolEvents.length > 0)">
      <div class="history-title">Deposits history</div>
      <div class="chart-wrapper">
        <Chart :dataPoints="chartPoints" :minY="0.0001" :maxY="maximumDeposit" stepped="before" currencySymbol="AVAX " class="deposit-chart"/>
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
  import {fromWei} from "../utils/calculate";
  import {aprToApy} from "../utils/calculate";

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
        depositValue: null,
        withdrawValue: null,
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
            validate: async (value) => {
              if (value > this.userDepositBalance) {
                return 'Withdraw amount exceeds your account deposit';
              }
              if (value > fromWei(await provider.getBalance(this.pool.address))) {
                return 'Withdraw amount exceeds amount available in pool';
              }
            }
          }
        ]
      }
    },
    computed: {
      ...mapState('pool', ['userDepositBalance', 'depositRate', 'totalSupply', 'poolEvents', 'pool', 'depositInterest']),
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
      },

      calculateDepositRate() {
        return aprToApy(this.depositRate);
      }
    },
    methods: {
      ...mapActions('pool', ['sendDeposit', 'withdraw']),
      async handleDeposit(value) {
        this.waitingForDeposit = true;
        this.depositValue = value;
        this.handleTransaction(this.sendDeposit, {amount: value})
        .then(
          () => {
            this.waitingForDeposit = false;
            this.depositValue = null;
          }
        );
      },
      async handleWithdraw(value) {
        this.waitingForWithdraw = true;
        this.withdrawValue = value;
        this.handleTransaction(this.withdraw, {amount: value})
        .then(
          () => {
            this.waitingForWithdraw = false;
            this.withdrawValue = null;
          }
        );
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.deposit-chart {
  margin-top: 30px;
}

.history-block {
  margin-top: 34px;
}

.bar {
  margin-bottom: 28px;
}

</style>
<style lang="scss">
@import "~@/styles/variables";

.pool {
  .currency-input-wrapper {
    width: 100%;
    margin-bottom: 20px;

    @media screen and (min-width: $md) {
      width: 530px;
    }
  }

  .chart-wrapper {
    width: 100%;
    margin-bottom: 60px;
  }
}
</style>
