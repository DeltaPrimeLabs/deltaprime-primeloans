<template>
  <div class="form-wrapper">
    <CurrencyInput
      v-on:newValue="updateWithdraw"
      :defaultValue="withdrawValue"
      :validators="withdrawValidators"
    />
    <div class="ltv">LTV: <b>{{ltvInfo}}</b></div>
    <div class="ltv-slider-wrapper">
      <Slider
        :min="ltv"
        :max="maxLTV"
        :value="calculatedLTV(this.withdrawValue)"
        :step="0.001"
        v-on:input="updateWithdrawFromLTV"
        :validators="ltvValidators"
        :labels="['Safer', 'Riskier']"
      />
    </div>
    <Button label="Reduce" :disabled="disabled" :waiting="waiting" v-on:click="submit()"/>
  </div>
</template>


<script>
import {mapActions, mapState} from "vuex";
  import CurrencyInput from "./CurrencyInput";
  import Slider from "./Slider";
  import Button from "./Button";

  export default {
    name: 'WithdrawForm',
    components: {
      CurrencyInput,
      Slider,
      Button
    },
    props: {

    },
    data() {
      return {
        withdrawValue: 0,
        errors: [false, false],
        waiting: false,
        label: '',
        withdrawValidators: [
          {
            require: (value) => value <= this.loanBalance,
            message: 'Withdraw amount exceeds current loan AVAX balance'
          }
        ],
      }
    },
    methods: {
      ...mapActions('loan', ['withdraw']),
      updateWithdraw(result) {
        this.withdrawValue = result.value;
        this.errors[0] = result.error;
        this.errors = [...this.errors];

        this.checkLTV(this.calculatedLTV(this.withdrawValue));
      },
      async submit() {
        if (!this.disabled) {
          this.waiting = true;
          this.handleTransaction(this.withdraw, {amount: this.withdrawValue})
          .then(
            () => {
              this.waiting = false;
              this.withdrawValue = null;
            }
          );
        }
      },
      updateWithdrawFromLTV(ltv) {
        this.checkLTV(ltv);
        this.withdrawValue = parseFloat((this.totalValue - (this.debt * ( 1 / ltv + 1))).toFixed(4));
        if (this.withdrawValue < 0) {
          this.withdrawValue = 0;
        }
      },
      checkLTV(value) {
        this.errors[2] = value > this.maxLTV;
        this.errors = [...this.errors];
      },
      calculatedLTV(withdraw) {
        if (withdraw) {
          return this.debt / (this.totalValue - this.debt - withdraw);
        } else {
          return this.ltv;
        }
      }
    },
    computed: {
      ...mapState('loan', ['loan', 'debt', 'totalValue', 'ltv', 'loanBalance']),
      ...mapState('network', ['balance']),
      disabled() {
        return this.waiting || this.errors.includes(true) || !this.debt;
      },
      ltvInfo() {
        return this.$options.filters.percent(this.calculatedLTV(this.withdrawValue));
      },
      maxLTVFromLoanBalance() {
        return Math.min(this.maxLTV, this.calculatedLTV(this.loanBalance));
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/form-wrapper";
</style>

