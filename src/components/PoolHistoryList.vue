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
    name: 'PoolEventsList',
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