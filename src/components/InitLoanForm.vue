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
      ref="loanInput"
      v-on:newValue="updateLoan"
      v-on:inputChange="loanInputChange()"
      :defaultValue="loan"
      :validators="loanValidators"
    />
    <div class="ltv">LTV: <span class="LTV-value">{{ calculatedLTV | percent }}</span></div>
    <div class="ltv-slider">
      <Slider
        ref="slider"
        :min="0"
        :max="maxInitialLTV"
        :value="calculatedLTV"
        :step="0.000001"
        v-on:input="updateLoanFromLTV"
        :validators="ltvValidators"
        :labels="['Safer', 'Riskier']"
      />
    </div>
    <Button label="Create loan" :disabled="disabled" :waiting="waiting" v-on:click="borrow()"/>
  </div>
</template>


<script>
import CurrencyInput from './CurrencyInput';
import Slider from './Slider';
import Button from './Button';
import {mapState, mapActions, mapGetters} from 'vuex';
import config from '@/config';

export default {
  name: 'InitLoanForm',
  props: {},
  components: {
    CurrencyInput,
    Slider,
    Button
  },
  data() {
    return {
      loan: 2,
      maxInitialLTV: config.MAX_ALLOWED_LTV,
      collateral: 1,
      waiting: false,
      userChangedLoan: false,
      errors: [false, false, false],
      collateralValidators: [
        {
          validate: value => {
            if (value > this.balance) {
              return 'Collateral amount exceeds your account balance';
            }
            if (value > config.MAX_COLLATERAL) {
              return `Maximum initial collateral is ${config.MAX_COLLATERAL} AVAX`;
            }
          }
        },
      ],
      loanValidators: [
        {
          validate: value => {
            if (this.getAvailable && value > this.getAvailable) {
              return 'Loan amount exceeds amount available in the pool';
            }
          }
        }
      ],
      ltvValidators: [
        {
          validate: () => {
            if (Number((this.calculatedLTV).toFixed(8)) > config.MAX_ALLOWED_LTV) {
              return `Maximum initial LTV is ${config.MAX_ALLOWED_LTV * 100}%`;
            }
          }
        }
      ]
    };
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
  mounted() {
    this.$refs.slider.onChange(this.calculatedLTV, true);
  },
  methods: {
    ...mapActions('loan', ['createNewLoan']),
    updateLoan(result) {
      this.loan = result.value;
      this.errors[0] = result.error;
      this.errors = [...this.errors];

      this.checkLTV(this.calculatedLTV);
      this.$refs.slider.onChange(this.calculatedLTV, true);
    },
    updateCollateral(result) {
      this.errors[1] = result.error;
      this.errors = [...this.errors];

      this.collateral = result.value;

      this.loan = this.defaultLoan(this.collateral);
      this.$refs.slider.onChange(this.calculatedLTV, true);
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
      if (ltv > 4.5) {
        ltv = 4.4999;
      }
      this.checkLTV(ltv);
      this.loan = Math.floor(this.collateral * ltv * 10000000) / 10000000;
    },
    checkLTV(value) {
      this.errors[2] = value > this.maxInitialLTV;
      this.errors = [...this.errors];
    },

    loanInputChange() {
      this.$refs.slider.onChange(this.calculatedLTV, true);
    }
  }
};
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
    width: 530px;
    margin-bottom: 35px;
  }
}
</style>
