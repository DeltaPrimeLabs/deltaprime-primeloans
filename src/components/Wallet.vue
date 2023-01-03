<template>
  <div class="wallet">
    <img class="logo" src="src/assets/icons/avax-icon.svg"/>
    <div class="network">{{network}}</div>
    <div class="separator"></div>
    <div class="account" v-tooltip="{content: account, classes: 'info-tooltip long'}">{{ account | tx(true) }}</div>
    <div class="balance">{{ accountBalance | avax }}</div>
    <img class="logo" src="src/assets/icons/avax-icon.svg"/>
  </div>
</template>


<script>
  import { mapState } from "vuex";

  export default {
    name: 'Wallet',
    props: {
      title: String
    },
    computed: {
      ...mapState('network', ['provider', 'account', 'accountBalance']),
      network() {
        return 'Avalanche';
      },
    },
    data() {
      return {

      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.wallet {
  display: flex;
  font-weight: 500;
  font-size: 14px;

  @media screen and (max-width: $md) {
    font-size: initial;
  }
}

.account {
  margin-right: 13px;
  color: $steel-gray;
  font-weight: 500;
}

.logo {
  height: 16px;
  vertical-align: middle;
  margin-left: 5px;
  transform: translateY(2px);
}

.separator {
  width: 2px;
  height: 25px;
  flex-grow: 0;
  margin: 0 13px 0 14px;
  transform: translateY(-2px);
  border: solid 1px $smoke-gray;
}

.network {
  margin-left: 5px;
}
</style>

