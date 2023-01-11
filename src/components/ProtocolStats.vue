<template>
  <div class="container">
    <div class="main-content">
      <div class="protocol-stats">
        <div class="tvl">
          <div class="label">TVL: </div>
          <div class="number">${{ numberWithCommas(poolLiquidity.toFixed(2)) }}</div>
          <br>
          <div  class="borrow-collateral">
            <div class="borrow">
              <div class="label">Total collateral: </div>
              <div class="number">${{ numberWithCommas(parseFloat(protocolCollateral.toFixed(2))) }} </div>
            </div>
            <div class="collateral">
              <div class="label">Total borrowed: </div>
              <div class="number">${{ numberWithCommas(parseFloat(totalBorrowed.toFixed(2))) }} </div>
            </div>
          </div>
        </div>
        <div class="pools">
          <Block v-for="pool of poolsList" v-bind:key="pool.asset.symbol">
            <div class="title">{{pool.asset.symbol}} pool</div>
            <div class="stat">
              <div class="desc">Provided:</div>
              <div class="value">{{pool.asset.symbol}} {{numberWithCommas(parseFloat(pool.tvl).toFixed(2))}}</div>
            </div>
            <div class="stat">
              <div class="desc">Borrowed:</div>
              <div class="value">{{pool.asset.symbol}} {{numberWithCommas(parseFloat(pool.totalBorrowed).toFixed(2))}}</div>
            </div>
            <div class="stat">
              <div class="desc">Utilisation:</div>
              <div class="value">{{pool.totalBorrowed / pool.tvl | percent}}</div>
            </div>
            <div class="stat">
              <div class="desc">Deposit APY:</div>
              <div class="value">{{pool.apy | percent}}</div>
            </div>
            <div class="stat">
              <div class="desc">Borrow APY:</div>
              <div class="value">{{pool.borrowingAPY | percent}}</div>
            </div>
          </Block>
        </div>
        <div class="factory">
          <Block>
            <div class="title">Loans</div>
            <div class="stat">
              <div class="desc">Number of loans:</div>
              <div class="value">{{loanAddresses.length}}</div>
            </div>
            <div class="loan-list">
              <div class="loan-list-header">
                <div>Address</div>
                <div>Health</div>
                <div>Total value</div>
                <div>Debt</div>
                <div>Collateral</div>
                <div>Solvent</div>
              </div>
              <div
                  v-for="loan of loans" v-bind:key="loan.address"
                  class="loan"
                  v-bind:class="{
                    'endangered': loan.health < 1.04,
                    'insolvent': loan.health <= 1 || !loan.solvent,
                  }"
              >
                <div><a :href="`https://snowtrace.io/address/${loan.address}`" target="_blank">{{loan.address | tx}}</a></div>
                <div>{{parseFloat(loan.health).toFixed(3)}}</div>
                <div>{{parseFloat(loan.totalValue).toFixed(2)}}</div>
                <div>{{parseFloat(loan.debt).toFixed(2)}}</div>
                <div>{{parseFloat(loan.collateral).toFixed(2)}}</div>
                <div>{{loan.solvent}}</div>
              </div>
            </div>
          </Block>
        </div>
    </div>
  </div>
</div>
</template>

<script>

import config from '../config';
import Block from './Block';
import {mapActions, mapState} from 'vuex';
import {wrapContract} from "../utils/blockchain";
const ethers = require('ethers');
import SMART_LOAN from '@artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import addresses from '../../common/addresses/avax/token_addresses.json';
import {fromWei} from "../utils/calculate";

export default {
  name: 'ProtocolStats',
  components: {
    Block,
  },
  async mounted() {
    this.initPools();
    if (window.provider) {
      await this.poolStoreSetup();
      await this.fundsStoreSetup();
    } else {
      setTimeout(async () => {
        await this.poolStoreSetup();
        await this.fundsStoreSetup();
      }, 1000);

    }
  },

  data() {
    return {
      funds: config.ASSETS_CONFIG,
      totalTVL: 0,
      totalDeposit: 0,
      poolsList: null,
      protocolCollateral: 0,
      totalBorrowed: 0,
      loanAddresses: [],
      loans: []
    };
  },
  computed: {
    ...mapState('poolStore', ['pools']),
    ...mapState('fundsStore', ['smartLoanFactoryContract']),
    poolLiquidity() {
      return parseFloat(this.poolsList[0].tvl) * parseFloat(this.poolsList[0].asset.price) + parseFloat(this.poolsList[1].tvl) * parseFloat(this.poolsList[1].asset.price) + parseFloat(this.protocolCollateral);
    }
  },

  watch: {
    pools: {
      handler() {
        setTimeout(() => {
          this.setupPoolsList();
        });
      }
    },
    smartLoanFactoryContract: {
      async handler(factory) {
        if (factory) {
          console.log(factory)
          this.loanAddresses = await factory.getAllLoans();
          await this.setupLoans();
        }
      }
    },
  },

  methods: {
    ...mapActions('poolStore', ['poolStoreSetup']),
    ...mapActions('fundsStore', ['fundsStoreSetup']),
    setupPoolsList() {
      setTimeout(() => {
        this.poolsList = Object.values(this.pools);
        console.log(this.poolsList)
        this.setupTotalTVL();
        this.setupTotalDeposit();
      }, 100);
    },

    setupTotalTVL() {
      let totalTVL = 0;
      this.poolsList.forEach(pool => {
        totalTVL += pool.tvl * pool.asset.price;
      });
      this.totalTVL = totalTVL;
    },

    setupTotalDeposit() {
      let totalDeposit = 0;
      this.poolsList.forEach(pool => {
        totalDeposit += pool.deposit * pool.asset.price;
      });
      this.totalDeposit = totalDeposit;
      this.$forceUpdate();

    },

    initPools() {
      const pools = [];
      Object.entries(config.POOLS_CONFIG).forEach(([symbol, pool]) => {
        pools.push({
          asset: {
            symbol: symbol
          }
        });
      });
      this.poolsList = pools;
    },

    numberWithCommas(x) {
      let parts = x.toString().split(".");
      parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,".");
      return parts.join(",");
    },

    async setupLoans() {
      const assets = Object.keys(addresses);

      let sumCollateral = 0;
      let sumBorrowed = 0;

      let loansUnsorted = [];
      for (let address of this.loanAddresses) {
        const smartLoanContract = new ethers.Contract(address, SMART_LOAN.abi, provider.getSigner());
        const wrapped = await wrapContract(smartLoanContract, assets);
        const status = await wrapped.getFullLoanStatus();
        loansUnsorted.push({
          address: address,
          totalValue: fromWei(status[0]),
          debt: fromWei(status[1]),
          collateral: fromWei(status[0]) - fromWei(status[1]),
          twv: fromWei(status[2]),
          health: fromWei(status[3]),
          solvent: status[4] !== 1e-18
        })

        sumCollateral += fromWei(status[0]) - fromWei(status[1]);
        sumBorrowed += fromWei(status[1]);
      }

      this.protocolCollateral = sumCollateral;
      this.totalBorrowed = sumBorrowed;

      this.loans = loansUnsorted.sort((a, b) => {
        return a.health - b.health;
      });

    }
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
.pools {
  display: flex;
  justify-content: space-between;

  .block-wrapper {
    width: 48%;

    .title {
      margin-bottom: 20px;
    }
  }
}

.factory {
  margin-top: 30px;
}

.borrow-collateral {
  display: flex;
  width: 900px;
  justify-content: space-between;
}

.loan-list {
  width: 100%;
  margin-top: 40px;
  color: $dark-gray;

  .loan-list-header {
    display: flex;
    justify-content: space-between;
    text-align: left;
    font-weight: 500;

    > div {
      width: 100px;
    }
  }

  .loan {
    display: flex;
    justify-content: space-between;
    text-align: left;

    > div {
      width: 100px;
    }


    a {
      text-decoration: none;
      font-weight: 500;
      color: #7d7d7d;
    }

    &.insolvent {
      color: #f64254;
    }

    &.endangered {
      color: #F4D35E;
    }
  }
}

.borrow, .collateral {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat {
  display: flex;
  justify-content: space-between;
  width: 100%;
  color: #7d7d7d;
  margin-top: 10px;

  .desc {
    font-weight: 600;
    font-size: 18px;
  }

  .value {
    font-size: 16px;

  }
}

.tvl {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;

  .label {
    font-size: 40px;
    font-weight: bold;
    color: black;
  }

  .number {
    font-size: 60px;
    margin-top: 50px;
    margin-bottom: 50px;
    color: #7d7d7d;
  }

}

</style>