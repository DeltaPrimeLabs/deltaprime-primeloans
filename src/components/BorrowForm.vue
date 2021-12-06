<template>
  <div class="form-wrapper">
    <CurrencyInput
      v-on:newValue="updateBorrow"
      :defaultValue="borrowValue"
      :validators="borrowValidators"
    />
    <div class="ltv">LTC: <b>{{ltvInfo}}</b></div>
    <div class="ltv-slider-wrapper">
      <Slider
        :min="ltv"
        :max="maxLTV"
        :value="calculatedLTV"
        :step="0.001"
        v-on:input="updateBorrowFromLTV"
        :validators="ltvValidators"
        :labels="['Safer', 'Riskier']"
      />
    </div>
    <Button label="Borrow" :disabled="disabled" :waiting="waiting" v-on:click="submit()"/>
  </div>
</template>


<script>
import {mapActions, mapGetters, mapState} from "vuex";
  import CurrencyInput from "./CurrencyInput";
  import Slider from "./Slider";
  import Button from "./Button";

  export default {
    name: 'BorrowForm',
    components: {
      CurrencyInput,
      Slider,
      Button
    },
    props: {

    },
    data() {
      return {
        borrowValue: 0,
        errors: [false, false],
        waiting: false,
        label: '',
        borrowValidators: [
          {
            require: value => value <= this.getAvailable,
            message: 'Borrow amount exceeds amount available in the pool'
          }
        ],
      }
    },
    methods: {
      ...mapActions('loan', ['borrow']),
      updateBorrow(result) {
        this.borrowValue = result.value;
        this.errors[0] = result.error;
        this.errors = [...this.errors];

        this.checkLTV(this.calculatedLTV);
      },
      async submit() {
        if (!this.disabled) {
          this.waiting = true;
          this.handleTransaction(this.borrow, {amount: this.borrowValue})
          .then(
            () => {
              this.waiting = false;
              this.borrowValue = null;
            }
          );
        }
      },
      updateBorrowFromLTV(ltv) {
        this.checkLTV(ltv);
        this.borrowValue = parseFloat((ltv * (this.totalValue - this.debt) - this.debt).toFixed(2));
      },
      checkLTV(value) {
        this.errors[2] = value > this.maxLTV;
        this.errors = [...this.errors];
      }
    },
    computed: {
      ...mapState('loan', ['loan', 'debt', 'totalValue', 'ltv']),
      ...mapGetters('pool', ['getAvailable']),
      calculatedLTV() {
        if (this.borrowValue) {
          return (this.debt + this.borrowValue) / (this.totalValue - this.debt);
        } else {
          return this.ltv;
        }
      },
      disabled() {
        return this.waiting || this.errors.includes(true) || !this.debt;
      },
      ltvInfo() {
        return this.$options.filters.percent(this.calculatedLTV);
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/form-wrapper";
</style>

