<template>
  <div class="form-wrapper">
    <CurrencyInput
      v-on:newValue="updateRepay"
      :defaultValue="repayValue"
      :validators="repayValidators"
      :max="maxRepay"
    />
    <div class="ltv" v-html="LTVInfo"></div>
    <div class="ltv-slider-wrapper">
      <Slider
        :min="minLtv"
        :max="ltv"
        :value="calculatedLTV(repayValue)"
        :step="0.0001"
        v-on:input="updateRepayFromLTV"
        :validators="ltvValidators"
        :labels="['Safer', 'Riskier']"
      />
    </div>
    <Button label="Repay" :disabled="disabled" :waiting="waiting" v-on:click="submit()"/>
  </div>
</template>


<script>
import {mapActions, mapState} from "vuex";
  import CurrencyInput from "./CurrencyInput";
  import Slider from "./Slider";
  import Button from "./Button";
  import config from "@/config";

  export default {
    name: 'RepayForm',
    components: {
      CurrencyInput,
      Slider,
      Button
    },
    props: {

    },
    data() {
      return {
        repayValue: 0,
        errors: [false, false],
        waiting: false,
        label: '',
        repayValidators: [
          {
            validate: (value) => {
              if (value > this.debt) {
                return 'Repay amount exceeds borrowed amount';
              }
              if (value > this.loanBalance) {
                return 'Repay amount exceeds current AVAX balance for Prime Account'
              }
            }
          }
        ]
      }
    },
    methods: {
      ...mapActions('loan', ['repay']),
      updateRepay(result) {
        this.repayValue = result.value;
        this.errors[0] = result.error;
        this.errors = [...this.errors];

        this.checkLTV(this.calculatedLTV(this.repayValue));
      },
      async submit() {
        if (!this.disabled) {
          this.waiting = true;
          this.handleTransaction(this.repay, {amount: this.repayValue})
          .then(() => {
            this.waiting = false;
            this.repayValue = null;
          });
        }
      },
      updateRepayFromLTV(ltv) {
        this.checkLTV(ltv);
        this.repayValue = parseFloat((this.debt - ltv * (this.totalValue - this.debt)).toFixed(4));
        if (this.repayValue > this.debt) {
          this.repayValue = this.debt;
        }
        if (this.repayValue < 0) {
          this.repayValue = 0;
        }
      },
      checkLTV(value) {
        this.errors[2] = value > this.maxLTV;
        this.errors = [...this.errors];
      },
      calculatedLTV(repay) {
        if (repay) {
          return (this.debt - repay) / (this.totalValue - this.debt);
        } else {
          return this.ltv;
        }
      }
    },
    computed: {
      ...mapState('loan', ['loan', 'debt', 'totalValue', 'ltv', 'loanBalance']),
      disabled() {
        return this.waiting || this.errors.includes(true);
      },
      LTVInfo() {
        if (this.calculatedLTV(this.repayValue) === Number.POSITIVE_INFINITY) {
          return 'Loan fully repaid'
        } else {
          return `LTV: <b>${this.$options.filters.percent(this.calculatedLTV(this.repayValue))}</b>`;
        }
      },
      maxRepay() {
        return Math.min(this.loanBalance, this.debt);
      },
      minLtv() {
        return this.calculatedLTV(Math.min(this.debt, this.loanBalance));
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/form-wrapper";
</style>

