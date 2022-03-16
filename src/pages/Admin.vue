<template>
  <div class="container admin">
    <Bar title="Pool statistics">
      <Value label="Surplus"
             :primary="{value: surplus, type: 'avax', showIcon: true}" />
      <Value label="Borrowing Rate"
             :primary="{value: borrowingRate, type: 'percent'}"/>
      <Value label="Deposit Rate"
             :primary="{value: depositRate, type: 'percent'}"/>
      <Value label="Pool Balance"
             :primary="{value: poolBalance, type: 'avax', showIcon: true}" />
      <Value label="Total borrowed"
             :primary="{value: totalBorrowed, type: 'avax', showIcon: true}" />
      <Value label="Total supply"
             :primary="{value: totalSupply, type: 'avax', showIcon: true}" />
    </Bar>
    <Block class="block high-risk-loans" :bordered="true">
      <div class="title">High-risk loans</div>
      <table id="investmentsTable">
        <thead>
          <tr>
            <th>SmartLoan address</th>
            <th>LTV</th>
          </tr>
        </thead>
        <tbody>
          <tr class="no-loans" v-if="!loading && riskyLoans.length === 0">No loans with LTV > 450%</tr>
          <tr v-for="loan in riskyLoans">
            <td>{{loan.address}}</td>
            <td><b class="ltv" :class="{'red': loan.ltv > 5000}">{{loan.ltv / 1000 | percent}}</b></td>
          </tr>
        </tbody>
      </table>
      <div v-if="loading" class="loader">
        <vue-loaders-ball-beat color="#A6A3FF" scale="1"></vue-loaders-ball-beat>
      </div>
    </Block>
  </div>
</template>


<script>
import LOAN_FACTORYTUP from '@contracts/SmartLoansFactoryTUP.json'
import LOAN_FACTORY from '@contracts/SmartLoansFactory.json'
import POOLTUP from '@contracts/PoolTUP.json';
import LOAN from '@contracts/SmartLoan.json'
import {ethers} from "ethers";
import config from "@/config";
import Block from "@/components/Block.vue";
import Value from "@/components/Value.vue";
import Bar from "@/components/Bar.vue";
import {mapState} from "vuex";
import {WrapperBuilder} from "redstone-evm-connector";
import {fromWei} from "../utils/calculate";

export default {
    name: 'Admin',
    components: {
      Block,
      Bar,
      Value
    },
    props: {
      fields: [
        'Account',
        'Balance',
        'Profit'
      ]
    },
    data() {
      return {
        riskyLoans: null,
        loading: true,
        poolBalance: null
      }
    },
    computed: {
      ...mapState('network', ['provider']),
      ...mapState('pool', ['depositRate', 'borrowingRate', 'totalBorrowed', 'totalSupply']),
      surplus() {
        return this.poolBalance + this.totalBorrowed - this.totalSupply;
      }
    },
    methods: {
      loadLoansInfo() {
        const loanFactory = new ethers.Contract(
            LOAN_FACTORYTUP.address,
            LOAN_FACTORY.abi,
            this.provider.getSigner()
        );

        loanFactory.getAllLoans()
          .then(
            async (res) => {
              this.riskyLoans = [];

              const promises = [];
              const addresses = [];


              res.forEach(
                address => {
                  const loan = new ethers.Contract(address, LOAN.abi, this.provider.getSigner());
                  loan.iface = new ethers.utils.Interface(LOAN.abi);

                  const wrappedLoan = WrapperBuilder
                      .wrapLite(loan)
                      .usingPriceFeed(config.dataProviderId);

                  promises.push(wrappedLoan.getFullLoanStatus())
                  addresses.push(wrappedLoan.address)
                }
              );

              let statuses = await Promise.all(promises);

              statuses.forEach(
                (status, index) => {
                  const ltv = status[2];

                  if (ltv > 4500) {
                    this.riskyLoans.push(
                        {
                          address: addresses[index],
                          ltv: ltv
                        }
                    )

                    this.riskyLoans.sort((a, b) => b.ltv - a.ltv)
                  }
                }
              );
              this.loading = false;
            });
      }
    },
    watch: {
      provider: {
        async handler(newVal) {
          if (newVal) {
            this.loadLoansInfo();
            this.poolBalance = fromWei(await this.provider.getBalance(POOLTUP.address));
          }
        },
        immediate: true
      },
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.title {
  font-size: 24px;
  font-weight: bold;
  width: 100%;
  text-align: center;
}

table {
  th {
    text-align: left;
  }
}

.loader {
  margin-top: 20px;
}

.ltv {
  &.red {
    color: $red;
  }
}

.high-risk-loans {
  margin-top: 36px;
}

.no-loans {
  text-align: center;
  font-size: 16px;
  margin-top: 20px;
}
</style>
<style lang="scss">
.admin {
  .bar {
    .elements {
      display: flex;
      flex-wrap: wrap;

      .value-wrapper {
        margin-bottom: 10px;
        flex: 0 0 33%;
      }
    }
  }
}
</style>
