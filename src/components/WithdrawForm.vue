<template>
  <div class="form-wrapper">
    <CurrencyInput
      v-on:newValue="updateWithdraw"
      v-on:inputChange="currencyInputChange"
      :defaultValue="withdrawValue"
      :validators="withdrawValidators"
    />
    <div class="ltv">LTV: <b>{{this.calculateLTV(this.withdrawValue) | percent}}</b></div>
    <div class="ltv-slider-wrapper">
      <Slider
        ref="slider"
        :min="ltv"
        :max="maxAllowedLTV"
        :step="0.0001"
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
        withdrawValue: null,
        errors: [false, false],
        waiting: false,
        label: '',
        withdrawValidators: [
          {
            validate: (value) => {
              if (value > this.loanBalance) {
                return 'Withdraw amount exceeds current loan AVAX balance';
              }
            },
          }
        ],
      }
    },
    mounted() {
      this.$refs.slider.onChange(this.calculateLTV(this.withdrawValue), true);
    },
    methods: {
      ...mapActions('loan', ['withdraw']),
      updateWithdraw(result) {
        this.withdrawValue = result.value;
        this.errors[0] = result.error;
        this.errors = [...this.errors];

        this.checkLTV(this.calculateLTV(this.withdrawValue));
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
        this.withdrawValue = parseFloat((this.totalValue - (this.debt * ( 1 / ltv + 1))).toFixed(6));
        if (this.withdrawValue < 0) {
          this.withdrawValue = 0;
        }
      },
      checkLTV(value) {
        this.errors[2] = value > this.maxAllowedLTV;
        this.errors = [...this.errors];
      },
      calculateLTV(withdraw) {
        if (withdraw) {
          return this.debt / (this.totalValue - this.debt - withdraw);
        } else {
          return this.ltv;
        }
      },
      currencyInputChange(inputValue) {
        this.$refs.slider.onChange(this.calculateLTV(inputValue), true);
      }
    },
    computed: {
      ...mapState('loan', ['loan', 'debt', 'totalValue', 'ltv', 'loanBalance']),
      ...mapState('network', ['balance']),
      disabled() {
        return this.withdrawValue == null || this.waiting || this.errors.includes(true);
      },
      maxLTVFromLoanBalance() {
        return Math.min(this.maxAllowedLTV, this.calculateLTV(this.loanBalance));
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/form-wrapper";
</style>

