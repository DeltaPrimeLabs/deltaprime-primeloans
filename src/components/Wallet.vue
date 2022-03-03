<template>
  <div class="wallet">
    <div class="balance">{{ balance | avax }}<img class="logo" src="src/assets/icons/avax-icon.svg"/>
</div>
    <div class="account">{{ account | tx(true) }}</div>
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
      ...mapState('network', ['account', 'balance'])
    },
    data() {
      return {

      }
    },
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.wallet {
  display: flex;
  border-radius: 14px;
  box-shadow: 7px 7px 30px 0 rgba(191, 188, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.3);
  padding: 15px 20px;
  font-weight: 500;
  font-size: 14px;

  @media screen and (max-width: $md) {
    font-size: initial;
  }
}

.account {
  margin-left: 7px;

  @media screen and (min-width: $md) {
    margin-left: 20px;
  }
}

.logo {
  opacity: 0.7;
  height: 16px;
  vertical-align: middle;
  margin-left: 5px;
}
</style>

