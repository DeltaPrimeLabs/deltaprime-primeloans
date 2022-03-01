<template>
  <div class="list">
    <div class="elements">
      <template v-for="item in items">
        <div v-bind:key="item.time.toString()" class="element">
          <div>{{ item.type }}</div>
          <div>{{ item.time | date }}<a :href="getTransactionUrl(item.tx)" target="_blank"><i class="fa fa-external-link" aria-hidden="true"></i></a></div>
          <div>{{ item.value}}<img class="logo" :src="logoSrc(item.asset)"/></div>
        </div>
      </template>
    </div>
  </div>
</template>


<script>
  import { transactionUrl } from "../utils/blockchain";

  export default {
    name: 'LoanHistoryList',
    props: {
      title: String,
      items: []
    },
    data() {
      return {

      }
    },
    methods: {
      getTransactionUrl(tx) {
        return transactionUrl(tx);
      }
    }
  }
</script>

<style lang="scss" scoped src="@/styles/list.scss"></style>
<style lang="scss" scoped>
.element {
  > div {
    flex: 0 0 33.3333%;
    text-align: left;

    &:last-of-type {
      text-align: right;
    }
  }
}

.list {
  margin-top: 40px;
}
</style>

