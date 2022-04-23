<template>
  <div class="form-wrapper">
    <CurrencyInput
      v-on:newValue="updateRepay"
      v-on:inputChange="currencyInputChange"
      :defaultValue="repayValue"
      :validators="repayValidators"
      :max="maxRepay"
    />
    <div class="ltv" v-html="LTVInfo"></div>
    <div class="ltv-slider-wrapper">
      <Slider
        ref="slider"
        :min="minLtv"
        :max="ltv"
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
        repayValue: null,
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
    mounted() {
      this.$refs.slider.onChange(this.calculateLTV(this.repayValue), true);
    },
    methods: {
      ...mapActions('loan', ['repay']),
      updateRepay(result) {
        this.repayValue = result.value;
        this.errors[0] = result.error;
        this.errors = [...this.errors];

        this.checkLTV(this.calculateLTV(this.repayValue));
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
        this.repayValue = parseFloat((this.debt - ltv * (this.totalValue - this.debt)).toFixed(6));
        if (this.repayValue > this.debt) {
          this.repayValue = this.debt;
        }
        if (this.repayValue < 0) {
          this.repayValue = 0;
        }
      },
      checkLTV(value) {
        this.errors[2] = value > this.maxAllowedLTV;
        this.errors = [...this.errors];
      },
      calculateLTV(repay) {
        let ltv;
        if (repay) {
          ltv = (this.debt - repay) / (this.totalValue - this.debt);
        } else {
          ltv = this.ltv;
        }
        return Math.round(ltv * 10000) / 10000;
      },
      currencyInputChange(inputValue) {
        this.$refs.slider.onChange(this.calculateLTV(inputValue), true);
      }
    },
    computed: {
      ...mapState('loan', ['loan', 'debt', 'totalValue', 'ltv', 'loanBalance']),
      disabled() {
        return this.repayValue == null || this.waiting || this.errors.includes(true);
      },
      LTVInfo() {
        if (this.calculateLTV(this.repayValue) === Number.POSITIVE_INFINITY) {
          return 'Loan fully repaid'
        } else {
          return `LTV: <b>${this.$options.filters.percent(this.calculateLTV(this.repayValue))}</b>`;
        }
      },
      maxRepay() {
        return Math.min(this.loanBalance, this.debt);
      },
      minLtv() {
        return this.calculateLTV(Math.min(this.debt, this.loanBalance));
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/form-wrapper";
</style>

