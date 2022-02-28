<template>
  <div class="form-wrapper">
    <CurrencyInput
      v-on:newValue="updateBorrow"
      :defaultValue="borrowValue"
      :validators="borrowValidators"
    />
    <div class="ltv">LTV: <b>{{ltvInfo}}</b></div>
    <div class="ltv-slider-wrapper">
      <Slider
        :min="ltv"
        :max="maxLTV"
        :value="calculatedLTV(borrowValue)"
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
            validate: value => {
              if (value > this.getAvailable) {
                return 'Borrow amount exceeds amount available in the pool'
              }
            }
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

        this.checkLTV(this.calculatedLTV(this.borrowValue));
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
        this.borrowValue = parseFloat((ltv * (this.totalValue - this.debt) - this.debt).toFixed(4));
        if (this.borrowValue < 0) {
          this.borrowValue = 0;
        }
      },
      checkLTV(value) {
        this.errors[2] = value > this.maxLTV;
        this.errors = [...this.errors];
      },
      calculatedLTV(borrow) {
        if (borrow) {
          return (this.debt + borrow) / (this.totalValue - this.debt);
        } else {
          return this.ltv;
        }
      }
    },
    computed: {
      ...mapState('loan', ['loan', 'debt', 'totalValue', 'ltv']),
      ...mapGetters('pool', ['getAvailable']),
      disabled() {
        return this.waiting || this.errors.includes(true);
      },
      ltvInfo() {
        return this.$options.filters.percent(this.calculatedLTV(this.borrowValue));
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/form-wrapper";
</style>

