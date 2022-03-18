<template>
  <div class="container">
    <Block class="block" :bordered="true">
      <div class="title">Ranking</div>
      <table id="investmentsTable">
        <thead>
          <tr>
            <th>Nickname / Prime Account</th>
            <th>Value</th>
            <th>Profit</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(loan) in loans">
            <td class="account" :class="{user: loan.owner === account}" @mouseover="() => {loan.showFullAddress = true}">
              <div class="nft">
                <img v-if="loan.nftId" :src="`src/assets/wolves/${loan.nftId}.png`" />
              </div>
              <span v-if="loan.owner === account">You</span><span v-else>{{loan.account | tx}}</span>
              <img v-if="loan.owner !== account" class="copy" @click="copyToClipboard(loan.account)" src="src/assets/icons/copy.png"/>
            </td>
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
import Vue from "vue";

export default {
    name: 'Ranking',
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
      ...mapState('network', ['provider', 'account']),
      ...mapState('pool', ['deploymentBlock']),
      ...mapState('nft', ['borrowNftContract']),
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
                    fetchEventsInBatches(loan.address, topics, provider, config.COMPETITION_START_BLOCK),
                    wrappedLoan.owner()]
                  ).then(
                    res => {
                      const [loanEvents, collateralFromPayments] = parseLogs(wrappedLoan, res[0].flat());

                      Promise.all(
                        [
                          wrappedLoan.getFullLoanStatus(),
                          this.borrowNftContract.tokenOfOwnerByIndex(res[1], 0),
                        ]
                      ).then(
                          (res2) => {
                            const status = res2[0];

                            const totalValue = fromWei(status[0]);
                            const debt = fromWei(status[1]);

                            const profit = (totalValue - debt) - collateralFromPayments;

                            this.loans.push(
                                {
                                  nftId: parseInt(res2[1]) + 1,
                                  account: wrappedLoan.address,
                                  owner: res[1],
                                  totalValue: totalValue,
                                  profit: profit
                                }
                            )

                            this.loans.sort((a, b) => b.profit - a.profit)
                            this.loading = false;
                          }
                      )
                        }
                      );
                    }
                  )
                }
          );
      },
      copyToClipboard(data) {
        navigator.clipboard.writeText(data);
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
  color: #00bf68;

  &.red {
    color: #f64254;
  }
}

table {
  border-collapse: collapse;

  tr {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding-left: 6px;
    padding-right: 6px;
  }

  thead {
    tr th {
      padding-bottom: 8px;
    }
  }

  tbody {

    td {
      display: flex;
      align-items: center;
    }

    tr {
      border-style: solid;
      border-width: 2px 0 0 0;
      border-image-source: linear-gradient(to right, #dfe0ff 43%, #ffe1c2 62%, #ffd3e0 79%);
      border-image-slice: 1;
      height: 51px;
    }
  }

  td:nth-of-type(2), th:nth-of-type(2) {
    text-align: right;
    justify-content: right;
    padding-right: 40%;
  }

  td:nth-of-type(3), th:nth-of-type(3) {
    text-align: right;
    justify-content: flex-end;
  }
}

.nft {
  height: 40px;
  width: 40px;
  border: solid 2px white;
  box-shadow: 4px 4px 14px 0 rgba(191, 188, 255, 0.25);
  border-radius: 9999999px;
  object-fit: cover;
  margin-right: 14px;

  img {
    border-radius: 9999px;
    background-image: url("../assets/images/wolf-background.png");
    background-repeat: no-repeat;
    background-size: contain;
  }
}

.copy {
  cursor: pointer;
  height: 12px;
  margin-left: 5px;
}

.account {
  &.user {
    font-weight: 700;
  }
}
</style>

