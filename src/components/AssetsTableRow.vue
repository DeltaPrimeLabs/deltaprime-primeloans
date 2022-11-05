<template>
  <div class="fund-table-row-component" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="asset">
      <div class="table__cell asset">
        <img class="asset__icon" :src="getAssetIcon(asset.symbol)">
        <div class="asset__info">
          <div class="asset__name">{{ asset.symbol }}</div>
          <div class="asset__loan" v-if="asset.symbol === 'AVAX' && avaxPool">Loan APY:
            {{ avaxPool.borrowingAPY | percent }}
          </div>
          <div class="asset__loan" v-if="asset.symbol === 'USDC' && usdcPool">Loan APY:
            {{ usdcPool.borrowingAPY | percent }}
          </div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value balance">
        <template v-if="assetBalances && assetBalances[asset.symbol]">
          <div class="double-value__pieces">
            <LoadedValue :check="() => assetBalances[asset.symbol] != null" :value="formatTokenBalance(assetBalances[asset.symbol])"></LoadedValue>
          </div>
          <div class="double-value__usd">
            <span v-if="assetBalances[asset.symbol]">{{ assetBalances[asset.symbol] * asset.price | usd }}</span>
          </div>
        </template>
        <template v-if="!(assetBalances && assetBalances[asset.symbol])">
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value loan">
        <template v-if="asset.symbol === 'AVAX' && avaxDebt">
          <div class="double-value__pieces">{{ avaxDebt | smartRound }}</div>
          <div class="double-value__usd">{{ avaxDebt * asset.price | usd }}</div>
        </template>
        <template v-if="asset.symbol === 'USDC' && usdcDebt">
          <div class="double-value__pieces">{{ usdcDebt | smartRound }}</div>
          <div class="double-value__usd">{{ usdcDebt * asset.price | usd }}</div>
        </template>
        <template v-if="(asset.symbol !== 'AVAX' && asset.symbol !== 'USDC') || !avaxDebt && !usdcDebt">
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell trend">
        <div class="trend__chart-change">
          <SmallChartBeta :data-points="asset.prices"
                          :is-stable-coin="asset.isStableCoin"
                          :line-width="2"
                          :width="60"
                          :height="25"
                          :positive-change="asset.todayPriceChange > 0">
          </SmallChartBeta>
          <ColoredValueBeta v-if="asset.todayPriceChange" :value="asset.todayPriceChange" :formatting="'percent'"
                            :percentage-rounding-precision="2" :show-sign="true"></ColoredValueBeta>
        </div>
        <IconButtonMenuBeta
          class="chart__icon-button"
          :config="{iconSrc: 'src/assets/icons/enlarge.svg', tooltip: 'Show chart'}"
          v-on:iconButtonClick="toggleChart()">
        </IconButtonMenuBeta>
      </div>

      <div class="table__cell price">
        {{ asset.price | usd }}
      </div>

      <div></div>

      <div class="table__cell actions">
        <IconButtonMenuBeta
          class="actions__icon-button"
          v-for="(actionConfig, index) of actionsConfig"
          v-bind:key="index"
          :config="actionConfig"
          v-on:iconButtonClick="actionClick">
        </IconButtonMenuBeta>
      </div>
    </div>

    <div class="chart-container" v-if="showChart">
      <SmallBlock v-on:close="toggleChart()">
        <Chart :data-points="asset.prices"
               :line-width="3"
               :min-y="asset.minPrice"
               :max-y="asset.maxPrice"
               :positive-change="asset.todayPriceChange > 0">
        </Chart>
      </SmallBlock>
    </div>

  </div>
</template>

<script>
import SmallChartBeta from './SmallChartBeta';
import ColoredValueBeta from './ColoredValueBeta';
import IconButtonMenuBeta from './IconButtonMenuBeta';
import Chart from './Chart';
import SmallBlock from './SmallBlock';
import LoadedValue from './LoadedValue';
import config from '../config';
import redstone from 'redstone-api';
import Vue from 'vue';
import {mapActions, mapState} from 'vuex';
import {aprToApy} from '../utils/calculate';
import BorrowModal from './BorrowModal';
import SwapModal from './SwapModal';
import AddFromWalletModal from './AddFromWalletModal';
import WithdrawModal from './WithdrawModal';
import RepayModal from './RepayModal';
import addresses from '../../common/addresses/avax/token_addresses.json';
import {formatUnits, parseUnits} from '@/utils/calculate';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const BORROWABLE_ASSETS = ['AVAX', 'USDC'];

const ethers = require('ethers');

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function totalSupply() public view returns (uint256 supply)',
  'function totalDeposits() public view returns (uint256 deposits)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)'
];


export default {
  name: 'AssetsTableRow',
  components: {LoadedValue, SmallBlock, Chart, IconButtonMenuBeta, ColoredValueBeta, SmallChartBeta},
  props: {
    asset: {},
  },
  mounted() {
    this.setupActionsConfiguration();
    this.setup24HourChange();
  },
  data() {
    return {
      actionsConfig: null,
      showChart: false,
      rowExpanded: false,
    };
  },
  computed: {
    ...mapState('fundsStore', ['smartLoanContract', 'avaxDebt', 'ltv', 'avaxDebt', 'usdcDebt', 'assetBalances', 'fullLoanStatus']),
    ...mapState('poolStore', ['avaxPool', 'usdcPool', 'pools']),
    ...mapState('network', ['provider', 'account', 'accountBalance']),

    loanValue() {
      return this.formatTokenBalance(this.debt);
    },

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    }
  },
  methods: {
    ...mapActions('fundsStore', ['swap', 'fund', 'borrow', 'withdraw', 'withdrawNativeToken', 'repay', 'createAndFundLoan', 'fundNativeToken']),
    setupActionsConfiguration() {
      this.actionsConfig = [
        {
          iconSrc: 'src/assets/icons/plus.svg',
          tooltip: 'Add / Borrow',
          menuOptions: [
            {
              key: 'ADD_FROM_WALLET',
              name: 'Add from wallet'
            },
            BORROWABLE_ASSETS.includes(this.asset.symbol) ?
              {
                key: 'BORROW',
                name: 'Borrow',
                disabled: !this.hasSmartLoanContract || !BORROWABLE_ASSETS.includes(this.asset.symbol),
                disabledInfo: 'To borrow, you need to add some funds from you wallet first'
              }
              : null
          ]
        },
        {
          iconSrc: 'src/assets/icons/minus.svg',
          tooltip: 'Withdraw / Repay',
          disabled: !this.hasSmartLoanContract,
          menuOptions: [
            {
              key: 'WITHDRAW',
              name: 'Withdraw',
            },
            {
              key: 'REPAY',
              name: 'Repay',
            }
          ]
        },
        {
          iconSrc: 'src/assets/icons/swap.svg',
          tooltip: 'Swap',
          iconButtonActionKey: 'SWAP',
          disabled: !this.hasSmartLoanContract
        },
      ];
    },

    toggleChart() {
      if (this.rowExpanded) {
        this.showChart = false;
        this.rowExpanded = false;
      } else {
        this.rowExpanded = true;
        setTimeout(() => {
          this.showChart = true;
        }, 200);
      }
    },

    formatTokenBalance(balance) {
      const balanceOrderOfMagnitudeExponent = String(balance).split('.')[0].length - 1;
      const precisionMultiplierExponent = 5 - balanceOrderOfMagnitudeExponent;
      const precisionMultiplier = Math.pow(10, precisionMultiplierExponent >= 0 ? precisionMultiplierExponent : 0);
      return balance !== null ? String(Math.round(balance * precisionMultiplier) / precisionMultiplier) : '';
    },

    setup24HourChange() {
      const date24HoursAgo = Date.now() - 1000 * 3600 * 24;
      redstone.getHistoricalPrice(this.asset.symbol, {
        date: date24HoursAgo,
      }).then(price => {
        const priceChange = this.asset.price - price.value;
        Vue.set(this.asset, 'todayPriceChange', priceChange / this.asset.price);
      });
    },

    actionClick(key) {
      switch (key) {
        case 'BORROW':
          this.openBorrowModal();
          break;
        case 'ADD_FROM_WALLET':
          this.openAddFromWalletModal();
          break;
        case 'WITHDRAW':
          this.openWithdrawModal();
          break;
        case 'REPAY':
          this.openRepayModal();
          break;
        case 'SWAP':
          this.openSwapModal();
          break;
      }
    },

    openBorrowModal() {
      console.log(this.pools);
      const pool = this.pools[this.asset.symbol];
      const modalInstance = this.openModal(BorrowModal);
      modalInstance.asset = this.asset;
      modalInstance.assetBalance = Number(this.assetBalances[this.asset.symbol]);
      modalInstance.ltv = this.ltv;
      modalInstance.totalCollateral = this.fullLoanStatus.totalValue - this.fullLoanStatus.debt;
      // TODO refresh pool.totalBorrowed
      modalInstance.poolTVL = Number(pool.tvl) - Number(pool.totalBorrowed);
      modalInstance.loanAPY = pool.apy;
      modalInstance.maxLTV = 4.5;
      modalInstance.$on('BORROW', value => {
        const borrowRequest = {
          asset: this.asset.symbol,
          amount: value
        };
        this.handleTransaction(this.borrow, {borrowRequest: borrowRequest}).then(() => {
          this.closeModal();
        });
      });
    },

    openSwapModal() {
      const modalInstance = this.openModal(SwapModal);
      modalInstance.sourceAsset = this.asset.symbol;
      modalInstance.sourceAssetBalance = this.assetBalances[this.asset.symbol];
      modalInstance.targetAsset = Object.keys(config.ASSETS_CONFIG).filter(asset => asset !== this.asset.symbol)[0];
      modalInstance.$on('SWAP', swapRequest => {
        this.handleTransaction(this.swap, {swapRequest: swapRequest}).then(() => {
          this.closeModal();
        });
      });
    },

    async openAddFromWalletModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      modalInstance.asset = this.asset;
      modalInstance.walletAssetBalance = await this.getWalletAssetBalance();
      modalInstance.walletNativeTokenBalance = this.accountBalance;
      modalInstance.assetBalance = Number(this.assetBalances[this.asset.symbol]);
      modalInstance.ltv = this.ltv;
      modalInstance.totalCollateral = this.fullLoanStatus.totalValue - this.fullLoanStatus.debt;
      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
          if (this.smartLoanContract.address === NULL_ADDRESS) {
            this.handleTransaction(this.createAndFundLoan, {asset: addFromWalletEvent.asset, value: addFromWalletEvent.value}).then(() => {
              this.closeModal();
            });
          } else {
            if (addFromWalletEvent.asset === 'AVAX') {
              this.handleTransaction(this.fundNativeToken, {value: addFromWalletEvent.value}).then(() => {
                this.closeModal();
              });
            } else {
              const fundRequest = {
                value: String(addFromWalletEvent.value),
                asset: this.asset.symbol,
                assetDecimals: config.ASSETS_CONFIG[this.asset.symbol].decimals
              };
              this.handleTransaction(this.fund, {fundRequest: fundRequest}).then(() => {
                this.closeModal();
              });
            }
          }
        }
      });
    },

    openWithdrawModal() {
      const modalInstance = this.openModal(WithdrawModal);
      modalInstance.asset = this.asset;
      modalInstance.ltv = this.ltv;
      modalInstance.totalCollateral = this.totalValue - this.debt;
      modalInstance.$on('WITHDRAW', withdrawEvent => {
        if (withdrawEvent.withdrawAsset === 'AVAX') {
          const withdrawRequest = {
            asset: withdrawEvent.withdrawAsset,
            value: withdrawEvent.value,
            assetDecimals: config.ASSETS_CONFIG[this.asset.symbol].decimals
          };
          this.handleTransaction(this.withdrawNativeToken, {withdrawRequest: withdrawRequest}).then(() => {
            this.closeModal();
          });
        } else {
          const withdrawRequest = {
            asset: this.asset.symbol,
            value: withdrawEvent.value,
            assetDecimals: config.ASSETS_CONFIG[this.asset.symbol].decimals
          };
          this.handleTransaction(this.withdraw, {withdrawRequest: withdrawRequest}).then(() => {
            this.closeModal();
          });
        }
      });
    },

    openRepayModal() {
      const modalInstance = this.openModal(RepayModal);
      modalInstance.asset = this.asset;
      modalInstance.ltv = this.ltv;
      modalInstance.totalCollateral = 101;
      modalInstance.$on('REPAY', value => {
        const repayRequest = {
          asset: this.asset.symbol,
          amount: value
        };
        this.handleTransaction(this.repay, {repayRequest: repayRequest}).then(() => {
          this.closeModal();
        });
      });
    },

    async getWalletAssetBalance() {
      const tokenContract = new ethers.Contract(addresses[this.asset.symbol], erc20ABI, this.provider.getSigner());
      const walletAssetBalanceResponse = await tokenContract.balanceOf(this.account);
      const walletAssetBalance = formatUnits(walletAssetBalanceResponse, config.ASSETS_CONFIG[this.asset.symbol].decimals);
      return Number(walletAssetBalance);
    },
  },
  watch: {
    smartLoanContract: {
      handler(smartLoanContract) {
        if (this) {
          this.setupActionsConfiguration();
        }
      },
    }
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.fund-table-row-component {
  height: 60px;
  transition: all 200ms;

  &.expanded {
    height: 387px;
  }

  .table__row {
    display: grid;
    grid-template-columns: repeat(3, 1fr) 20% 1fr 76px 102px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: linear-gradient(to right, #dfe0ff 43%, #ffe1c2 62%, #ffd3e0 79%);
    border-image-slice: 1;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.asset {
        align-items: center;

        .asset__icon {
          width: 20px;
          height: 20px;
        }

        .asset__info {
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-left: 8px;
          font-weight: 500;
        }

        .asset__loan {
          font-size: $font-size-xxs;
          color: $medium-gray;
        }
      }

      &.balance {
        align-items: flex-end;
      }

      &.loan {
        align-items: flex-end;
      }

      &.trend {
        justify-content: center;
        align-items: center;
        margin-left: 49px;

        .trend__chart-change {
          display: flex;
          flex-direction: column;
          font-size: $font-size-xxs;
          align-items: center;
        }

        .chart__icon-button {
          margin-left: 7px;
        }
      }

      &.price {
        justify-content: flex-end;
        align-items: center;
        font-weight: 500;
      }

      &.actions {
        align-items: center;

        .actions__icon-button {
          &:not(:last-child) {
            margin-right: 12px;
          }
        }
      }

      &.table__cell--double-value {
        flex-direction: column;
        justify-content: center;

        .double-value__pieces {
          font-size: $font-size-xsm;
          font-weight: 600;
        }

        .double-value__usd {
          font-size: $font-size-xxs;
          color: $medium-gray;
          font-weight: 500;
        }

        &.loan {
          .double-value__pieces {
            font-weight: 500;
          }
        }
      }

      .no-value-dash {
        height: 1px;
        width: 15px;
        background-color: $medium-gray;
      }
    }
  }

  .chart-container {
    margin: 2rem 0;

    .colored-value {
      font-weight: 500;
    }
  }
}

</style>