<template>
  <StatsSection>
    <div class="transaction-history-component">
      <div class="transactions-table">
        <TableHeader :config="transactionHistoryTableConfig"></TableHeader>

        <div class="table-body" v-if="transactionHistory">
          <div class="transaction-row" v-for="transaction of transactionHistory">
            <div class="transaction-cell date" v-if="transaction.date">{{ transaction.date | timeAgo }}</div>
            <div class="transaction-cell type">{{ transaction.transactionAction }}</div>
            <div v-if="transaction.basicTransactionAmount" class="transaction-cell amount">
              {{ transaction.fromAmountNumber | smartRound(5, true) | formatWithSpaces }} {{ transaction.fromToken }}
            </div>
            <div v-if="transaction.txType === 'Swap' || transaction.txType === 'DebtSwap'"
                 class="transaction-cell amount-swap">
              {{ transaction.fromAmountNumber | smartRound(5, true) | formatWithSpaces }} {{ transaction.fromToken }}
              <DeltaIcon class="swap-icon" :icon-src="'src/assets/icons/swap-arrow.svg'"
                         :size="16"
              ></DeltaIcon>
              {{ transaction.toAmountNumber | smartRound(5, true) | formatWithSpaces }} {{ transaction.toToken }}
            </div>
            <div v-if="transaction.txType === 'AddLiquidity' || transaction.txType === 'RemoveLiquidity'"
                 class="transaction-cell amount-swap">
              {{ transaction.fromAmountNumber | smartRound(5, true) | formatWithSpaces }} {{ transaction.fromToken }},
              {{ transaction.toAmountNumber | smartRound(5, true) | formatWithSpaces }} {{ transaction.toToken }}
            </div>
          </div>
        </div>
        <div class="loader-container" v-else v-bind:style="`height: ${(pageSize * 60) + 37}px;`">
          <VueLoadersBallBeat color="#A6A3FF" scale="2"></VueLoadersBallBeat>
        </div>
      </div>
      <Paginator v-if="totalTransactions"
                 :page-size="pageSize"
                 :total-elements="totalTransactions"
                 v-on:pageChange="pageChange">
      </Paginator>
    </div>
  </StatsSection>
</template>

<script>
import {mapState} from 'vuex';
import TableHeader from './TableHeader';
import {formatUnits} from '../utils/calculate';
import config from '../config';
import DeltaIcon from './DeltaIcon';
import Paginator from './Paginator';
import StatsSection from './stats/StatsSection';

export default {
  name: 'TransactionHistory',
  components: {
    StatsSection,
    Paginator,
    DeltaIcon,
    TableHeader
  },
  data() {
    return {
      account: {},
      transactionHistoryTableConfig: {},
      transactionHistory: null,
      totalTransactions: 0,
      pageSize: config.TRANSACTION_HISTORY_PAGE_SIZE,
      page: 0,
    };
  },
  computed: {
    ...mapState('serviceRegistry', ['statsService', 'accountService']),
    ...mapState('fundsStore', [
      'smartLoanContract',
    ]),
  },

  async mounted() {
    this.setupTableHeader();
    await this.initialGetTransactionHistory();
  },

  methods: {
    setupTableHeader() {
      this.transactionHistoryTableConfig = {
        gridTemplateColumns: '3fr 1fr 2fr',
        cells: [
          {
            label: 'Date',
            sortable: false,
            class: 'date',
            id: 'DATE',
          },
          {
            label: 'Action',
            sortable: false,
            class: 'action',
            id: 'ACTION',
          },
          {
            label: 'Amount',
            sortable: false,
            class: 'amount',
            id: 'AMOUNT',
          },
        ]
      };
    },

    async initialGetTransactionHistory() {
      this.accountService.observeAccountLoaded().subscribe(account => {
        this.account = account;
        this.getTransactionHistory(this.account, this.page, this.pageSize);
      })
    },

    async getTransactionHistory(accountAddress, page, pageSize) {
      const response = await this.statsService.getUserTransactionHistory(accountAddress, page, pageSize);
      this.transactionHistory = response.data.user.transactions;
      this.totalTransactions = response.data.user.numTransactions;
      this.$forceUpdate();
      this.transactionHistory = this.transactionHistory.map(transaction => this.parseTransactionData(transaction));
    },

    parseToken: function (transactionAsset) {
      if (transactionAsset) {
        if (config.ASSETS_CONFIG[transactionAsset]) {
          return transactionAsset;
        } else if (config.LP_ASSETS_CONFIG[transactionAsset]) {
          return config.LP_ASSETS_CONFIG[transactionAsset].name;
        } else {
          const protocol = Object.values(config.FARMED_TOKENS_CONFIG).flat().find(protocol => protocol.protocolIdentifier === transactionAsset);
          if (!protocol.isTokenLp) {
            return protocol.token;
          } else {
            return config.LP_ASSETS_CONFIG[protocol.token].name;
          }
        }
      } else {
        return 'AVAX';
      }
    },

    parseTransactionAction(transactionAction) {
      const transactionActionMap = {
        'Deposit': 'Deposited',
        'DepositNative': 'Deposited',
        'Withdraw': 'Withdrawn',
        'UnwrapAndWithdraw': 'Withdrawn',
        'Borrow': 'Borrowed',
        'Repay': 'Repaid',
        'Swap': 'Swapped',
        'DebtSwap': 'Swapped debt',
        'Stake': 'Staked',
        'Unstake': 'Unstaked',
        'AddLiquidity': 'Created LP Token',
        'RemoveLiquidity': 'Unwound LP Token',
      };

      return transactionActionMap[transactionAction] ? transactionActionMap[transactionAction] : transactionAction;
    },

    parseTransactionData(transaction) {
      const date = new Date(Number(transaction.timestamp) * 1000);
      const fromAssetDecimals = transaction.fromAsset && config.ASSETS_CONFIG[transaction.fromAsset] ? config.ASSETS_CONFIG[transaction.fromAsset].decimals : 18;
      const fromAmountNumber = fromAssetDecimals && transaction.fromAmount ? formatUnits(transaction.fromAmount, fromAssetDecimals) : null;
      const toAssetDecimals = transaction.toAsset && config.ASSETS_CONFIG[transaction.toAsset] ? config.ASSETS_CONFIG[transaction.toAsset].decimals : 18;
      const toAmountNumber = toAssetDecimals && transaction.toAmount ? formatUnits(transaction.toAmount, toAssetDecimals) : null;

      const fromToken = this.parseToken(transaction.fromAsset);
      const toToken = transaction.toAsset ? this.parseToken(transaction.toAsset) : null;
      const transactionAction = this.parseTransactionAction(transaction.txType);

      const specialTransactionsAmountForTxTypes = ['Swap', 'DebtSwap', 'AddLiquidity', 'RemoveLiquidity'];

      return {
        ...transaction,
        date: date,
        fromAmountNumber: fromAmountNumber,
        toAmountNumber: toAmountNumber,
        fromToken: fromToken,
        toToken: toToken,
        transactionAction: transactionAction,
        basicTransactionAmount: !specialTransactionsAmountForTxTypes.includes(transaction.txType)
      };
    },

    pageChange(page) {
      this.page = page;
      this.getTransactionHistory(this.account, this.page, this.pageSize);
    },
  }
};
</script>

<style scoped lang="scss">

.transaction-history-component {
  display: flex;
  flex-direction: column;
  width: 100%;

  .transactions-table {

    .transaction-row {
      display: grid;
      grid-template-columns: 3fr 1fr 2fr;
      height: 60px;
      border-style: solid;
      border-width: 0 0 2px 0;
      border-image-source: var(--asset-table-row__border);
      border-image-slice: 1;
      margin: 0 22px;

      .transaction-cell {
        display: flex;
        flex-direction: row;
        align-items: center;

        &.date {
          justify-content: flex-start;
        }

        &.type {
          justify-content: flex-start;
          padding-left: 8px;
        }

        &.amount {
          justify-content: flex-end;
          font-weight: 600;
        }

        &.amount-swap {
          justify-content: flex-end;
          font-weight: 600;

          .swap-icon {
            margin: 0 5px;
            transform: rotate(270deg);
            background: var(--icon-button__icon-color--default);

            &:hover {
              background: var(--icon-button__icon-color-hover--default);
            }
          }

        }
      }
    }

    .loader-container {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
    }
  }

}
</style>