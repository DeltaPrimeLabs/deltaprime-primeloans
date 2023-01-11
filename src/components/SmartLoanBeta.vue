<template>
  <div class="smart-loan-beta-component">
    <div class="account-apr-widget-wrapper">
      <AccountAprWidget :accountApr="accountApr" :no-smart-loan="noSmartLoanInternal"></AccountAprWidget>
    </div>
    <div class="container">
      <StatsBarBeta
        :collateral="noSmartLoanInternal ? 0 : getCollateral"
        :debt="noSmartLoanInternal ? 0 : debt"

        :health="noSmartLoanInternal ? 1 : health"
        :noSmartLoan="noSmartLoanInternal">
      </StatsBarBeta>
      <InfoBubble v-if="noSmartLoanInternal === true" cacheKey="ACCOUNT-INIT" style="margin-top: 40px">
        To unlock borrowing, add tokens with <img style="transform: translateY(-2px);" src="src/assets/icons/plus.svg"> button<br>
        and press "Deposit collateral".
      </InfoBubble>
      <InfoBubble v-if="noSmartLoanInternal === false" cacheKey="ACCOUNT-READY" style="margin-top: 40px">
        Your Prime Account is ready! Now you can borrow,<br>
         provide liquidity and farm on the Farms page.
      </InfoBubble>
      <InfoBubble v-if="wasLiquidated" cacheKey="LIQUIDATED-0" style="margin-top: 40px">
        Liquidation bots unwinded part of your positions<br>
        to repay borrowed funds and restore your health. <a href="https://docs.deltaprime.io/protocol/liquidations" target="_blank">More</a>.
      </InfoBubble>
      <div class="main-content">
        <Block :bordered="true">
          <Tabs v-on:tabChange="tabChange" :open-tab-index="selectedTabIndex" :arrow="true">
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
    <div class="tutorial-video" v-if="videoVisible">
      <div class="tutorial-video__close" v-on:click="closeVideo">
        <img class="close__icon" src="src/assets/icons/cross.svg">
      </div>
      <iframe width="560" height="315" src="https://www.youtube.com/embed/nyRbcSse60o" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>    </div>
  </div>
</template>

<script>
import StatsBarBeta from './StatsBarBeta';
import Banner from './Banner';
import Block from './Block';
import Tabs from './Tabs';
import Tab from './Tab';
import Assets from './Assets';
import InfoBubble from "@/components/InfoBubble.vue";
import {mapActions, mapGetters, mapState} from 'vuex';
import Farm from './Farm';
import AccountAprWidget from './AccountAprWidget';
import config from '../config';
import redstone from 'redstone-api';
import {formatUnits} from 'ethers/lib/utils';

const ASSETS_PATH = 'assets';
const FARMS_PATH = 'farms';

const ASSETS_PATH_NAME = 'Prime Account Assets';
const FARMS_PATH_NAME = 'Prime Account Farms';

const TUTORIAL_VIDEO_CLOSED_LOCALSTORAGE_KEY = 'TUTORIAL_VIDEO_CLOSED'

export default {
  name: 'SmartLoanBeta',
  components: {Farm, Assets, Block, StatsBarBeta, Tabs, Tab, InfoBubble, AccountAprWidget, Banner},
  computed: {
    ...mapState('fundsStore', ['assetBalances', 'fullLoanStatus', 'noSmartLoan', 'accountApr', 'smartLoanContract']),
    ...mapState('stakeStore', ['farms']),
    ...mapState('serviceRegistry', ['healthService']),
    ...mapState('network', ['account']),
    ...mapGetters('fundsStore', ['getHealth', 'getCollateral']),
    wasLiquidated() {
      console.log('this.smartLoanContract: ', this.smartLoanContract.address.toLowerCase())
      return [
        '0x6c4b7c993a4f68dF0D5DAf68F66BA2dAbC3345a0'.toLowerCase(),
        '0xe23448D99172d100c7D1112306AbDda686F517c6'.toLowerCase(),
        '0xE020F3729a0e7b5eeaCA3cCa5Af92d263aD0aD59'.toLowerCase(),
        '0x22C0a7a3D86D852032aeFB8dfa03b84e7FC4DAEc'.toLowerCase()
      ].indexOf(this.smartLoanContract.address.toLowerCase()) !== -1;
    },
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
      videoVisible: true,
    };
  },

  async mounted() {
    this.setupSelectedTab();
    this.watchHealthRefresh();
    this.setupVideoVisibility();
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

    watchHealthRefresh() {
      this.healthService.observeRefreshHealth().subscribe(() => {
        this.health = this.getHealth;
      })
    },

    closeVideo() {
      this.videoVisible = false;
      window.localStorage.setItem(TUTORIAL_VIDEO_CLOSED_LOCALSTORAGE_KEY, true);
    },

    setupVideoVisibility() {
      const videoWasClosed = window.localStorage.getItem(TUTORIAL_VIDEO_CLOSED_LOCALSTORAGE_KEY);
      this.videoVisible = !videoWasClosed;
    },
  },
};
</script>

<style lang="scss" scoped>

.main-content {
  margin-top: 30px;
  margin-bottom: 600px;
}

.account-apr-widget-wrapper {
  position: absolute;
  left: 50%;
  margin-left: -100px;
  width: 200px;
  top: 0;
}

.tutorial-video {
  position: fixed;
  border-radius: 25px;
  bottom: 20px;
  right: 20px;

  .tutorial-video__close {
    position: absolute;
    right: 0px;
    top: -35px;
    cursor: pointer;

    .close__icon {
      height: 25px;
      width: 25px;
    }
  }
}

</style>