<template>
  <div class="smart-loan container">
    <Bar class="loan-bar">
      <img class="dots clickable-icon" @click="showMenu = !showMenu" id="loan-menu-dots"/>
      <Menu v-if="showMenu" v-on:close="showMenu = false" clickElementId="loan-menu-dots" class="loan-menu">
        <div @click="closeTheLoan()">Close loan</div>
      </Menu>
      <div>
        <div class="rate-wrapper">
          Current APY: <span class="rate">{{borrowingRate | percent}}</span>
        </div>
      </div>
      <div class="stats">
        <div class="loan">
          <Value label="Loan"
                 :primary="{value: debt, type: 'avax', showIcon: true}"
                 :secondary="{value: avaxToUSD(debt), type: 'usd'}" />
          <div class="borrow-buttons">
            <img @click="showBorrowBlock(0)"
                 class="plus"
                 v-tooltip="'Borrow'"
            />
            <img class="slash" src="src/assets/icons/slash-small.svg"/>
            <img @click="showBorrowBlock(1)"
                 src="src/assets/icons/minus.svg"
                 class="minus"
                 v-tooltip="'Repay'"
            />
          </div>
        </div>
        <div class="ltv-value">
          <div class="label">
            LTV
            <img class="info-icon" src="src/assets/icons/info.svg" v-tooltip="'LTV is calculated as your debt divided by your current collateral'">
          </div>
          <div class="ltv-bar">
            <LTVBar />
          </div>
        </div>
        <div class="collateral">
          <Value label="Collateral"
                 :primary="{value: getCurrentCollateral, type: 'avax', showIcon: true}"
                 :secondary="{value: avaxToUSD(getCurrentCollateral), type: 'usd'}"
                 :tooltip="'Your current collateral is calculated as total value of your assets minus debt'" />
          <div class="fund-buttons">
            <img @click="showCollateralBlock(0)"
                 src="src/assets/icons/plus.svg"
                 class="plus"
                 v-tooltip="'Add collateral'"
            />
            <img class="slash" src="src/assets/icons/slash-small.svg"/>
            <img @click="showCollateralBlock(1)"
                 src="src/assets/icons/minus.svg"
                 class="minus"
                 v-tooltip="'Reduce collateral'"
            />
          </div>
        </div>
      </div>
    </Bar>
    <InfoBubble v-if="!borrowBlock && !collateralBlock" cacheKey="LOAN-INFO">
      Invest in assets using AVAX from loan and collateral. <br/>
      Remember to keep LTV below <b>{{maxAllowedLTV}}%</b>.
    </InfoBubble>
    <InfoBubble v-if="liquidatedEvent" :cacheKey="`LIQUIDATION-INFO-${liquidatedEvent.tx}`">
      Your account has been recently liquidated. <br/>
      Remember to keep LTV below <b>{{maxAllowedLTV}}%</b> to avoid liquidation.
    </InfoBubble>
    <Block v-if="borrowBlock" class="block borrow-block" :bordered="true">
      <img @click="borrowBlock = false" src="src/assets/icons/cross.svg" class="cross clickable-icon" />
      <Tabs :openTabIndex="tabIndex">
        <Tab title="Borrow" imgActive="add-deposit-active" img="add-deposit" imgPosition="left">
          <BorrowForm/>
        </Tab>
        <Tab title="Repay" imgActive="withdraw-deposit-active" img="withdraw-deposit" imgPosition="right">
          <RepayForm/>
        </Tab>
      </Tabs>
    </Block>
    <Block v-if="collateralBlock" class="block collateral-block" :bordered="true">
      <img @click="collateralBlock = false" src="src/assets/icons/cross.svg" class="cross clickable-icon" />
      <Tabs :openTabIndex="tabIndex">
        <Tab title="Add collateral" imgActive="add-deposit-active" img="add-deposit" imgPosition="left">
          <FundForm/>
        </Tab>
        <Tab title="Reduce collateral" imgActive="withdraw-deposit-active" img="withdraw-deposit" imgPosition="right">
          <WithdrawForm/>
        </Tab>
      </Tabs>
    </Block>
    <Block class="block assets-list" :bordered="true" >
      <AssetsList/>
    </Block>
    <Block class="block history-block" background="rgba(255, 255, 255, 0.3)" v-if="(loanEvents && loanEvents.length > 0)">
      <div class="history-title">Prime Account history</div>
      <LoanHistoryList :items="loanEvents" title="Prime Account History" class="history-list"/>
    </Block>
  </div>
</template>


<script>
import StakingList from "./StakingList";
var showMenu;

import Bar from "@/components/Bar.vue";
import Value from "@/components/Value.vue";
import AssetsList from "@/components/AssetsList.vue";
import Block from "@/components/Block.vue";
import Tabs from "@/components/Tabs.vue";
import Tab from "@/components/Tab.vue";
import LTVBar from "@/components/LTVBar.vue";
import CurrencyForm from "@/components/CurrencyForm.vue";
import LoanHistoryList from "@/components/LoanHistoryList.vue";
import Menu from "@/components/Menu.vue";
import {mapActions, mapGetters, mapState} from "vuex";
import RepayForm from "./RepayForm";
import BorrowForm from "./BorrowForm";
import FundForm from "./FundForm";
import WithdrawForm from "./WithdrawForm";
import InfoBubble from "./InfoBubble";
import config from "@/config";

export default {
  name: 'SmartLoan',
  data() {
    return {
      borrowBlock: false,
      collateralBlock: false,
      tabIndex: 0,
      showMenu: false
    }
  },
  components: {
    StakingList,
    BorrowForm,
    RepayForm,
    FundForm,
    WithdrawForm,
    Bar,
    Value,
    AssetsList,
    Block,
    CurrencyForm,
    Tab,
    Tabs,
    LTVBar,
    InfoBubble,
    LoanHistoryList,
    Menu
  },
  computed: {
    ...mapState('loan', ['loan', 'debt', 'totalValue', 'ltv', 'loanEvents']),
    ...mapState('pool', ['userDepositBalance', 'borrowingRate']),
    ...mapState('network', ['balance']),
    ...mapGetters('loan', ['getCurrentCollateral']),
    maxAllowedLTV() {
      return config.LIQUIDATION_LTV * 100;
    },
    liquidatedEvent() {
      if (!this.loanEvents) {
        return null;
      }
      return this.loanEvents.find(event => event.type === "Liquidated");
    }
  },
  methods: {
    ...mapActions('loan', ['closeLoan']),
    showBorrowBlock(tabIndex) {
      this.tabIndex = tabIndex;
      this.collateralBlock = false;
      this.borrowBlock = true;
    },
    showCollateralBlock(tabIndex) {
      this.tabIndex = tabIndex;
      this.borrowBlock = false;
      this.collateralBlock = true;
    },
    async closeTheLoan() {
      this.handleTransaction(this.closeLoan)
          .then(() => {
            this.repayValue = null;
          });
    }
  }
}
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
.block-title {
  margin-top: 15px;
  margin-bottom: 30px;
  font-size: 24px;
  font-weight: bold;
}

.loan-bar {
  margin-bottom: 28px;
}

.loan, .collateral {
  display: flex;
  justify-content: space-between;
  align-items: center;

  @media screen and (min-width: $md) {
    display: block;
    justify-content: initial;
    align-items: initial;
  }
}

.borrow-buttons, .fund-buttons {
  display: flex;
  flex-direction: column;

  @media screen and (min-width: $md) {
    justify-content: center;
    position: initial;
    transform: initial;
    flex-direction: initial;
    margin-top: 10px;
  }

  .slash {
    display: none;

    @media screen and (min-width: $md) {
      display: block;
    }
  }

  .plus, .minus {
    height: 24px;
    cursor: pointer;
    transition: transform .15s ease-in-out;

    &:hover {
      transform: scale(1.05);
    }
  }

  .plus {
    content: url(../assets/icons/plus.svg);

    &:hover {
      content: url(../assets/icons/hover/plus.svg);
    }
  }

  .minus {
    content: url(../assets/icons/minus.svg);

    &:hover {
      content: url(../assets/icons/hover/minus.svg);
    }
  }
}

.dots {
  height: 16px;
  content: url(../assets/icons/dots.svg);
  position: absolute;
  top: 20px;
  right: 10px;

  &:hover {
    content: url(../assets/icons/hover/dots.svg);
  }
}

.loan-menu {
  position: absolute;
  top: 42px;
  right: -86px;
}

.ltv-value {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-top: 30px;

  @media screen and (min-width: $md) {
    display: block;
    align-items: center;
    margin-top: 0;
  }

  .label {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;

    .info-icon {
      width: 18px;
      height: 18px;
      margin-left: 5px;
    }
  }

  .ltv-bar {
    display: flex;
    flex-direction: column;
    align-items: center;

    @media screen and (min-width: $md) {
      margin-top: 12px;
    }
  }
}

.collateral-block, .borrow-block {
  top: 6px;
  margin-bottom: 44px;

  &:before {
    position: absolute;
    transform: rotate(45deg);
    content: " ";
    width: 20px;
    height: 20px;
    background: white;
    top: -13px;
    border-radius: 3px;
    border-style: solid;
    border-width: 4px 0 0 4px;
  }
}

.collateral {
  margin-top: 30px;

  @media screen and (min-width: $md) {
    margin-top: 0;
  }
}

.borrow-block {
  &:before {
    left: 200px;
    border-color: #C8C8FF;
  }
}

.collateral-block {
  &:before {
    left: 750px;
    border-color: #E0CEDB;
  }
}

.cross {
  position: absolute;
  right: 20px;
  top: 20px;
  content: url(../assets/icons/cross.svg);

  &:hover {
    content: url(../assets/icons/hover/cross.svg);
  }
}

.history-block {
  margin-top: 34px;
}
</style>

<style lang="scss">
@import "~@/styles/variables";
.smart-loan {
  .loan-bar {
    position: relative;
  }

  .currency-input-wrapper {
    justify-content: space-between;

    @media screen and (min-width: $md) {
      margin-top: 2rem;
    }

    @media screen and (min-width: $md) {
      margin-top: 0px;
      width: 530px;
    }
  }

  .value-wrapper {
    height: 4.8rem;

    .label {
      text-align: start;
      width: 120px;

      @media screen and (min-width: $md) {
        text-align: center;
        width: initial;
      }
    }
  }

  .collateral-block {
    .tab-button {
      @media screen and (min-width: $md) {
        width: 365px !important;
      }
    }
  }

  .ltv-info {
    font-size: 14px;
  }
}

.assets-list.block.bordered::after {
  background-image: linear-gradient(145deg, #c9cbff 24%, #ffd8b1 38%, #fcb7cc 52%);
}

.staking-list {
  margin-top: 34px;
}

</style>

