<template>
  <div class="smart-loan-beta-component">
    <div class="container">
      <StatsBarBeta
        :collateral="noSmartLoanInternal ? 0 : getCollateral"
        :debt="noSmartLoanInternal ? 0 : debt"

        :health="noSmartLoanInternal ? 0 : getHealth"
        :noSmartLoan="noSmartLoanInternal">
      </StatsBarBeta>
      <InfoBubble v-if="noSmartLoanInternal === true" cacheKey="ACCOUNT-INIT" style="margin-top: 40px">
        To unlock borrowing, add tokens with <img style="transform: translateY(-2px);" src="src/assets/icons/plus.svg"> button.<br>
        This operation creates your Prime Account!
      </InfoBubble>
      <InfoBubble v-if="noSmartLoanInternal === false" cacheKey="ACCOUNT-READY" style="margin-top: 40px">
        Your Prime Account is ready! Now you can borrow,<br>
         provide liquidity and farm on the Farms page.
      </InfoBubble>
      <div class="main-content">
        <Block :bordered="true">
          <Tabs v-on:tabChange="tabChange" :open-tab-index="selectedTabIndex">
            <Tab :title="'Assets'"
                 :img-active="'src/assets/icons/assets_on.svg'"
                 :img-not-active="'src/assets/icons/assets_off.svg'">
              <Assets></Assets>
            </Tab>
            <Tab :title="'Farms'"
                 :img-active="'src/assets/icons/plant_on.svg'"
                 :img-not-active="'src/assets/icons/plant_off.svg'">
              <Farm></Farm>
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
import Assets from './Assets';
import InfoBubble from "@/components/InfoBubble.vue";
import {mapActions, mapGetters, mapState} from 'vuex';
import Farm from './Farm';
import config from '../config';
import redstone from 'redstone-api';
import {formatUnits} from 'ethers/lib/utils';

const ASSETS_PATH = 'assets';
const FARMS_PATH = 'farms';

const ASSETS_PATH_NAME = 'Prime Account Assets';
const FARMS_PATH_NAME = 'Prime Account Farms';

export default {
  name: 'SmartLoanBeta',
  components: {Farm, Assets, Block, StatsBarBeta, Tabs, Tab, InfoBubble},
  computed: {
    ...mapState('fundsStore', ['assetBalances', 'fullLoanStatus', 'noSmartLoan']),
    ...mapState('stakeStore', ['farms']),
    ...mapGetters('fundsStore', ['getHealth', 'getCollateral'])
  },
  watch: {
    assetBalances: {
      handler(balances) {
        this.assetBalancesChange(balances);
        this.updateLoanStatus(this.fullLoanStatus);
        this.$forceUpdate();
      },
    },
    fullLoanStatus: {
      handler(fullLoanStatus) {
        this.updateLoanStatus(fullLoanStatus);
      },
      immediate: true
    },
    noSmartLoan: {
      handler(noSmartLoan) {
        this.noSmartLoanInternal = noSmartLoan;
        this.updateLoanStatus(this.fullLoanStatus);
        this.$forceUpdate();
      },
      immediate: true
    },
  },
  data() {
    return {
      todayValue: 0,
      yesterdayValue: 0,
      debt: 0,
      totalValue: 0,
      health: 0,
      noSmartLoanInternal: null,
      selectedTabIndex: 0,
    };
  },

  async mounted() {
    this.setupSelectedTab();
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
  methods: {
    ...mapActions('fundsStore', ['fundsStoreSetup']),
    ...mapActions('poolStore', ['poolStoreSetup']),
    ...mapActions('stakeStore', ['stakeStoreSetup']),

    async assetBalancesChange(balances) {
      if (balances && balances.length > 0) {
        let todayValue = 0;
        let yesterdayValue = 0;
        const assets = config.ASSETS_CONFIG;
        const assetSymbols = Object.keys(assets);
        const todayPrices = await redstone.getPrice(assetSymbols);
        const yesterdayPrices = await redstone.getHistoricalPrice(assetSymbols, {date: Date.now() - 1000 * 3600 * 24});
        assetSymbols.forEach((symbol, index) => {
          if (balances[index]) {
            const balance = formatUnits(balances[index].balance, config.ASSETS_CONFIG[symbol].decimals);
            todayValue += balance * todayPrices[symbol].value;
            yesterdayValue += balance * yesterdayPrices[symbol].value;
          }
        });

        this.todayValue = todayValue;
        this.yesterdayValue = yesterdayValue;
      }
    },

    updateLoanStatus(fullLoanStatus) {
      if (fullLoanStatus) {
        this.totalValue = fullLoanStatus.totalValue;
        this.debt = fullLoanStatus.debt;
        this.health = this.getHealth;
      }
      this.$forceUpdate();
    },

    setupSelectedTab() {
      const url = document.location.href;
      const lastUrlPart = url.split('/').reverse()[0];
      if (lastUrlPart !== ASSETS_PATH && lastUrlPart !== FARMS_PATH) {
        this.$router.push({name: ASSETS_PATH_NAME});
      } else {
        if (lastUrlPart === ASSETS_PATH) {
          this.selectedTabIndex = 0;
        } else if (lastUrlPart === FARMS_PATH) {
          this.selectedTabIndex = 1;
        }
      }
    },

    tabChange(tabIndex) {
      if (tabIndex === 0) {
        this.$router.push({name: ASSETS_PATH_NAME});
      } else if (tabIndex === 1) {
        this.$router.push({name: FARMS_PATH_NAME});
      }
    },
  },
};
</script>

<style lang="scss" scoped>

.main-content {
  margin-top: 30px;
}

</style>