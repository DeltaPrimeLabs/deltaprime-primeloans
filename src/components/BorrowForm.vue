<template>
  <div class="form-wrapper">
    <CurrencyInput
      v-on:newValue="updateBorrow"
      v-on:inputChange="currencyInputChange"
      :defaultValue="borrowValue"
      :validators="borrowValidators"
    />
    <div class="ltv">LTV: <b>{{ calculateLTV(borrowValue) | percent }}</b></div>
    <div class="ltv-slider-wrapper">
      <Slider
        ref="slider"
        :min="ltv"
        :max="maxAllowedLTV"
        :step="0.0001"
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
        borrowValue: null,
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
    mounted() {
      this.$refs.slider.onChange(this.calculateLTV(this.borrowValue), true);
    },
    methods: {
      ...mapActions('loan', ['borrow']),
      updateBorrow(result) {
        this.borrowValue = result.value;
        this.errors[0] = result.error;
        this.errors = [...this.errors];

        this.checkLTV(this.calculateLTV(this.borrowValue));
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
        this.borrowValue = parseFloat((ltv * (this.totalValue - this.debt) - this.debt).toFixed(6));
        if (this.borrowValue < 0) {
          this.borrowValue = 0;
        }
      },
      checkLTV(value) {
        this.errors[2] = value > this.maxAllowedLTV;
        this.errors = [...this.errors];
      },
      calculateLTV(borrow) {
        let ltv;
        if (borrow) {
          ltv = (this.debt + borrow) / (this.totalValue - this.debt);
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
      ...mapState('loan', ['loan', 'debt', 'totalValue', 'ltv']),
      ...mapGetters('pool', ['getAvailable']),
      disabled() {
        return this.borrowValue == null || this.waiting || this.errors.includes(true);
      },
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/form-wrapper";
</style>

