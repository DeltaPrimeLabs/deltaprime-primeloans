6
<template>
  <div class="form-wrapper">
    <CurrencyInput
        v-on:newValue="updateFund"
        v-on:inputChange="currencyInputChange"
        :defaultValue="fundValue"
        :validators="fundValidators"
    />
    <div class="ltv">LTV: <b>{{ this.calculateLTV(this.fundValue) | percent }}</b></div>
    <div class="ltv-slider-wrapper">
      <Slider
          ref="slider"
          :min="calculateLTV(balance)"
          :max="ltv"
          :step="0.0001"
          v-on:input="updateFundFromLTV"
          :validators="ltvValidators"
          :labels="['Safer', 'Riskier']"
      />
    </div>
    <Button label="Add" :disabled="disabled" :waiting="waiting" v-on:click="submit()"/>
  </div>
</template>


<script>
import {mapActions, mapState} from "vuex";
import CurrencyInput from "./CurrencyInput";
import Slider from "./Slider";
import Button from "./Button";

export default {
  name: 'FundForm',
  components: {
    CurrencyInput,
    Slider,
    Button
  },
  props: {},
  data() {
    return {
      fundValue: null,
      errors: [false, false],
      waiting: false,
      label: '',
      fundValidators: [
        {
          validate: (value) => {
            if (value > this.balance) {
              return 'Fund amount exceeds user balance';
            }
            if (this.collateralFromPayments + value > config.MAX_COLLATERAL) {
              return `Collateral amount higher than the maximum of ${config.MAX_COLLATERAL} allowed`;
            }
          }
        }
      ],
    }
  },
  mounted() {
    this.$refs.slider.onChange(this.calculateLTV(this.fundValue), true);
  },
  methods: {
    ...mapActions('loan', ['fund']),
    ...mapActions('network', ['updateBalance']),
    updateFund(result) {
      this.fundValue = result.value;
      this.errors[0] = result.error;
      this.errors = [...this.errors];

      this.checkLTV(this.calculateLTV);
    },
    async submit() {
      if (!this.disabled) {
        this.waiting = true;
        this.handleTransaction(this.fund, {amount: this.fundValue})
            .then(
                async () => {
                  this.waiting = false;
                  this.fundValue = null;
                  await this.updateBalance();
                }
            );
      }
    },
    updateFundFromLTV(ltv) {
      this.checkLTV(ltv);
      this.fundValue = parseFloat(((this.debt * (1 / ltv + 1) - this.totalValue)).toFixed(6));
      if (this.fundValue < 0) {
        this.fundValue = 0;
      }
    },
    checkLTV(value) {
      this.errors[2] = value > this.maxAllowedLTV;
      this.errors = [...this.errors];
    },
    calculateLTV(fund) {
      if (fund) {
        return (this.debt) / (this.totalValue - this.debt + fund);
      } else {
        return this.ltv;
      }
    },
    currencyInputChange(inputValue) {
      this.$refs.slider.onChange(this.calculateLTV(inputValue), true);
    }
  },
  computed: {
    ...mapState('loan', ['loan', 'debt', 'totalValue', 'ltv', 'collateralFromPayments']),
    ...mapState('network', ['balance']),
    disabled() {
      return this.fundValue == null || this.waiting || this.errors.includes(true);
    },
  }
}
</script>

<style lang="scss" scoped>
@import "~@/styles/form-wrapper";
</style>

