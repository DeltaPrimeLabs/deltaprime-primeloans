<template>
  <div class="claim-page__content">
    <img class="claim-page__logo" src="src/assets/logo/claim-logo.svg" alt="">
    <div class="claim-page__label">
      Here you can claim your PRIME
    </div>
    <div class="claim-page__amount-text">
      Claimable amount: <span class="claim-page__amount">{{ claimableAmount }}</span>
    </div>
    <div class="claim-page__button">
      <BorderedButton :action="onClick"><span class="claim-page__button-text">Claim</span></BorderedButton>
    </div>
  </div>
</template>

<script>

import BorderedButton from "./BorderedButton.vue";

export default {
  name: 'ClaimPrime',
  components: {BorderedButton},
  async mounted() {
    this.initStoresWhenProviderAndAccountCreated();
    this.watchPools();
  },

  data() {
    return {
      claimableAmount: 10
    };
  },
  methods: {
    onClick() {
      console.log('click');
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.claim-page {
  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 500px;
    padding: 40px 50px 50px 50px;
    background: var(--claim-page__content-background);
    box-shadow: var(--claim-page__content-box-shadow);
    border-radius: 35px;
    margin: 100px auto 0 auto;
  }

  &__logo {
    height: 150px;
    width: 150px;
    filter: var(--claim-page__logo-box-shadow);
    margin-bottom: 40px;
  }

  &__label {
    color: var(--claim-page__label-color);
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 6px;
  }

  &__amount-text {
    font-size: 21px;
    font-weight: 500;
    color: var(--claim-page__amount-text-color);
    margin-bottom: 40px;
  }

  &__amount {
    font-weight: bold;
  }

  &__button-text {
    font-size: 20px;
    line-height: 24px;
    letter-spacing: 1px;
    color: #fff;
    font-weight: 800;
    text-transform: uppercase;
  }
}
</style>
