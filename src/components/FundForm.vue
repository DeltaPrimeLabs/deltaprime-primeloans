<template>
  <div class="form-wrapper">
    <CurrencyInput
      v-on:newValue="updateFund"
      :defaultValue="fundValue"
      :validators="fundValidators"
    />
    <div class="ltv">LTC: <b>{{LTVInfo}}</b></div>
    <div class="ltv-slider-wrapper">
      <Slider
        :min="calculatedLTV(balance)"
        :max="ltv"
        :value="calculatedLTV(fundValue)"
        :step="0.001"
        v-on:input="updateFundFromLTV"
        :validators="ltvValidators"
        :labels="['Safer', 'Riskier']"
      />
    </div>
    <Button label="Fund" :disabled="disabled" :waiting="waiting" v-on:click="submit()"/>
  </div>
</template>


<script>
import {mapActions, mapState} from "vuex";
  import CurrencyInput from "./CurrencyInput";
  import Slider from "./Slider";
  import Button from "./Button";
  import config from "@/config";

  export default {
    name: 'FundForm',
    components: {
      CurrencyInput,
      Slider,
      Button
    },
    props: {

    },
    data() {
      return {
        fundValue: 0,
        errors: [false, false],
        waiting: false,
        label: '',
        fundValidators: [
          {
            require: (value) => value <= this.balance,
            message: 'Fund amount exceeds user balance'
          }
        ],
      }
    },
    methods: {
      ...mapActions('loan', ['fund']),
      updateFund(result) {
        this.fundValue = result.value;
        this.errors[0] = result.error;
        this.errors = [...this.errors];

        this.checkLTV(this.calculatedLTV);
      },
      async submit() {
        if (!this.disabled) {
          this.waiting = true;
          this.handleTransaction(this.fund, {amount: this.fundValue})
          .then(
            () => {
              this.waiting = false;
              this.fundValue = null;
            }
          );
        }
      },
      updateFundFromLTV(ltv) {
        this.checkLTV(ltv);
        this.fundValue = parseFloat(((this.debt * ( 1 / ltv + 1) - this.totalValue)).toFixed(4));
        if (this.fundValue < 0) {
          this.fundValue = 0;
        }
      },
      checkLTV(value) {
        this.errors[2] = value > this.maxLTV;
        this.errors = [...this.errors];
      },
      calculatedLTV(fund) {
        if (fund) {
          return (this.debt) / (this.totalValue - this.debt + fund);
        } else {
          return this.ltv;
        }
      }
    },
    computed: {
      ...mapState('loan', ['loan', 'debt', 'totalValue', 'ltv']),
      ...mapState('network', ['balance']),
      disabled() {
        return this.waiting || this.errors.includes(true) || !this.debt;
      },
      LTVInfo() {
        return this.$options.filters.percent(this.calculatedLTV(this.fundValue));
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/form-wrapper";
</style>

