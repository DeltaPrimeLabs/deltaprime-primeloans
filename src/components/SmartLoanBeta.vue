<template>
  <div class="smart-loan-beta-component">
    <div class="container">
      <StatsBarBeta
        :total-value="noSmartLoan ? 0 : fullLoanStatus.totalValue"
        :debt="noSmartLoan ? 0 : fullLoanStatus.debt"
        :health="noSmartLoan ? 0 : getHealth">
      </StatsBarBeta>
      <InfoBubble v-if="noSmartLoan" cacheKey="ACCOUNT-INIT">
        Add funds from your wallet to start investing. <br>
        The first transaction creates your Prime Account.
      </InfoBubble>
      <div class="main-content">
        <Block :bordered="true">
          <Tabs>
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

export default {
  name: 'SmartLoanBeta',
  components: {Farm, Assets, Block, StatsBarBeta, Tabs, Tab, InfoBubble},
  computed: {
    ...mapState('fundsStore', ['assetBalances', 'fullLoanStatus', 'noSmartLoan']),
    ...mapGetters('fundsStore', ['getHealth'])
  },
  watch: {
    assetBalances: {
      handler(balances) {
        this.assetBalancesChange(balances);
      },
    }
  },
  data() {
    return {
      todayValue: 0,
      yesterdayValue: 0,
    };
  },

  async mounted() {
    this.setupClosingModalsOnEsc();
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

    setupClosingModalsOnEsc() {
      document.addEventListener('keyup', (event) => {
        if (event.key === 'Escape') {
          this.closeModal();
        }
      });
    },
  },
};
</script>

<style lang="scss" scoped>

.main-content {
  margin-top: 30px;
}

</style>