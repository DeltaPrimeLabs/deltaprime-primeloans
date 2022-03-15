<template>
  <div>
    <Block class="block" :bordered="true">
      <div class="title">Ranking</div>
      <table id="investmentsTable">
        <thead>
          <tr>
            <th>Prime Account</th>
            <th>Owner</th>
            <th>Total Value</th>
            <th>Profit</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="loan in loans">
            <td v-tooltip="loan.account">{{loan.account | tx}}</td>
            <td v-tooltip="loan.owner">{{loan.owner | tx}}</td>
            <td>{{avaxToUSD(loan.totalValue) | usd}}</td>
            <td><b class="profit" :class="{'red': loan.profit < 0}">{{avaxToUSD(loan.profit) | usd}}</b></td>
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
import LOAN from '@contracts/SmartLoan.json'
import {ethers} from "ethers";
import config from "@/config";
import {parseLogs} from "../utils/calculate";
import Block from "@/components/Block.vue";
import {mapState} from "vuex";
import {WrapperBuilder} from "redstone-evm-connector";
import {fromWei} from "@/utils/calculate";
import {fetchEventsInBatches} from "../utils/blockchain";

export default {
    name: 'SmartLoanList',
    components: {
      Block
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
        loans: null,
        loading: true
      }
    },
    computed: {
      ...mapState('network', ['provider']),
      ...mapState('pool', ['deploymentBlock']),
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
            res => {
              this.loans = [];
              res.forEach(
                address => {
                  const loan = new ethers.Contract(address, LOAN.abi, this.provider.getSigner());
                  loan.iface = new ethers.utils.Interface(LOAN.abi);

                  const wrappedLoan = WrapperBuilder
                    .wrapLite(loan)
                    .usingPriceFeed(config.dataProviderId);

                  const topics = [
                      loan.iface.getEventTopic("Funded"),
                      loan.iface.getEventTopic("Withdrawn"),
                      loan.iface.getEventTopic("Invested"),
                      loan.iface.getEventTopic("Redeemed"),
                      loan.iface.getEventTopic("Borrowed"),
                      loan.iface.getEventTopic("Repaid"),
                    ];

                  Promise.all([
                    fetchEventsInBatches(loan.address, topics, provider),
                    wrappedLoan.owner()]
                  ).then(
                    res => {
                      const [loanEvents, collateralFromPayments] = parseLogs(wrappedLoan, res[0].flat());

                      wrappedLoan.getFullLoanStatus().then(
                        status => {
                          const totalValue = fromWei(status[0]);
                          const debt = fromWei(status[1]);

                          const profit = (totalValue - debt) - collateralFromPayments;

                          this.loans.push(
                            {
                              account: wrappedLoan.address,
                              owner: res[1],
                              totalValue: totalValue,
                              profit: profit
                            }
                          )

                          this.loans.sort((a, b) => b.profit - a.profit)
                          this.loading = false;
                        }
                      );
                    }
                  )
                }
              )
            }
          );
      }
    },
    watch: {
      provider: {
        handler(newVal) {
          if (newVal) {
            this.loadLoansInfo();
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

.profit {
  color: $green;

  &.red {
    color: $red;
  }
}
</style>

