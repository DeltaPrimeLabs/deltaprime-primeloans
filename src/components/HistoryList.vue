<template>
  <div class="list">
    <div class="title">{{ title }}</div>
    <div class="elements">
      <template v-for="item in items">
        <div v-bind:key="item.time.toString()" class="element">
          <div>{{ item.time | date }}<a :href="getTransactionUrl(item.tx)" target="_blank"><i class="fa fa-external-link" aria-hidden="true"></i></a></div>
          <div>{{ item.type === "Withdrawal" ? "-" : ""}}{{ item.value | avax}}<img class="logo" :src="`src/assets/icons/avax-icon.svg`"/></div>
        </div>
      </template>
    </div>
  </div>
</template>


<script>
  import { transactionUrl } from "../utils/blockchain";

  export default {
    name: 'HistoryList',
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

<style lang="scss" scoped>
@import "~@/styles/variables";

.list {
  width: 100%;
}

.element {
  display: flex;
  justify-content: space-between;
  padding: 16px 0;
  border-style: solid;
  border-width: 2px 0 0 0;
  border-image-source: linear-gradient(91deg, rgba(223, 224, 255, 0.43), rgba(255, 225, 194, 0.62), rgba(255, 211, 224, 0.79));
  border-image-slice: 1;
  font-weight: 500;
}

.logo {
  height: 18px;
  opacity: 0.7;
  margin-left: 5px;
}

.fa-external-link {
  color: #7A7FFC;
  margin-left: 10px;
  vertical-align: middle;
  cursor: pointer;
}

.title {
  color: #696969;
  font-weight: 500;
  margin-bottom: 16px;
  font-size: 16px;
}

</style>

