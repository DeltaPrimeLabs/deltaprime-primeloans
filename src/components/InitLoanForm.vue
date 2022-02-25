<template>
  <div class="init-loan-form-wrapper">
    <div class="overlay" v-if="borrowingLocked"></div>
    <div class="title">Collateral</div>
    <CurrencyInput
      v-on:newValue="updateCollateral"
      :defaultValue="collateral"
      :validators="collateralValidators"
    />
    <div class="title">Loan</div>
    <CurrencyInput
      v-on:newValue="updateLoan"
      :defaultValue="loan"
      :validators="loanValidators"
    />
    <div class="ltv">LTV: <span class="LTV-value">{{calculatedLTV | percent}}</span></div>
    <div class="ltv-slider">
      <Slider
        :min="0"
        :max="maxInitialLTV"
        :value="calculatedLTV"
        :step="0.01"
        v-on:input="updateLoanFromLTV"
        :validators="ltvValidators"
        :labels="['Safer', 'Riskier']"
      />
    </div>
    <Button label="Create loan" :disabled="disabled" :waiting="waiting" v-on:click="borrow()"/>
  </div>
</template>


<script>
  import CurrencyInput from "./CurrencyInput";
  import Slider from "./Slider";
  import Button from "./Button";
  import {mapState, mapActions, mapGetters} from "vuex";
  import config from "@/config";

  export default {
    name: 'InitLoanForm',
    props: {
    },
    components: {
      CurrencyInput,
      Slider,
      Button
    },
    data() {
      return {
        loan: null,
        maxInitialLTV: config.DEFAULT_LTV,
        collateral: null,
        waiting: false,
        userChangedLoan: false,
        errors: [false, false, false],
        collateralValidators: [
          {
            validate: value => {
              if (value > this.balance) {
                return 'Collateral amount exceeds your account balance'
              }
            }
          },
        ],
        loanValidators: [
          {
            validate: value => {
              if (value > this.getAvailable) {
                return 'Loan amount exceeds amount available in the pool';
              }
            }
          }
        ],
        ltvValidators: [
          {
            validate: () => {
              if (this.calculatedLTV > config.DEFAULT_LTV) {
                `Maximum initial LTV is ${config.DEFAULT_LTV * 100}%`
              }
            }
          }
        ]
      }
    },
    computed: {
      ...mapState('network', ['balance']),
      ...mapGetters('nft', ['borrowingLocked']),
      ...mapGetters('pool', ['getAvailable']),
      disabled() {
        return this.waiting || this.errors.includes(true) || !this.collateral;
      },
      calculatedLTV() {
        if (this.loan && this.collateral) {
          return (this.loan) / this.collateral;
        } else {
          return 0;
        }
      }
    },
    methods: {
      ...mapActions('loan', ['createNewLoan']),
      updateLoan(result) {
        this.loan = result.value;
        this.errors[0] = result.error;
        this.errors = [...this.errors];

        this.checkLTV(this.calculatedLTV);
      },
      updateCollateral(result) {
        this.errors[1] = result.error;
        this.errors = [...this.errors];

        this.collateral = result.value;

        this.loan = this.defaultLoan(this.collateral)
      },
      async borrow() {
        if (!this.disabled) {
          this.waiting = true;

          if (this.loan === null) {
            this.loan = 0;
          }

          this.handleTransaction(this.createNewLoan, {amount: this.loan, collateral: this.collateral})
            .then(
              () => {
                this.waiting = false;
              }
            );
        }
      },
      defaultLoan(value) {
        return (value && !isNaN(value)) ? value * 2 : 0;
      },
      updateLoanFromLTV(ltv) {
        this.checkLTV(ltv);
        this.loan = parseFloat((this.collateral * ltv).toFixed(2));
      },
      checkLTV(value) {
        this.errors[2] = value > this.maxInitialLTV;
        this.errors = [...this.errors];
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.init-loan-form-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.title {
  margin-bottom: 20px;
}

.ltv {
  color: #7d7d7d;
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 15px;

  .ltv-value {
    font-weight: 700;
  }
}

.ltv-slider {
  margin-bottom: 50px;
  width: 490px;
}
</style>
<style lang="scss">
.init-loan-form-wrapper {
  .currency-input-wrapper {
    width: 490px;
    margin-bottom: 35px;
  }
}
</style>
