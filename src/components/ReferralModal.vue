<template>
  <div id="modal" class="referral-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Create referral nick
      </div>

      <div class="image-container">
        <img src="src/assets/icons/referral-img.png"/>
      </div>

      <div class="modal-top-desc">
        Create your own referral nick. The nick would be used to share among yours referees
      </div>

      <TextInput :validators="validators"
                 v-on:inputChange="inputChange"
                 v-on:newValue="textInputChange">
      </TextInput>

      <div class="transaction-summary-wrapper">
      </div>

      <div class="button-wrapper">
        <Button :label="'Save'" v-on:click="submit()" :disabled="false"
                :waiting="false"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import CurrencyInput from './CurrencyInput';
import Button from './Button';
import BarGaugeBeta from './BarGaugeBeta';
import config from '../config';
import {calculateHealth} from '../utils/calculate';
import TextInput from "./TextInput.vue";

export default {
  name: 'BorrowModal',
  components: {
    TextInput,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {},

  data() {
    return {
      value: 0,
      validators: [],
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
    });
  },

  computed: {},

  methods: {
    submit() {
      this.transactionOngoing = true;
      this.$emit('BORROW', this.value);
    },

    inputChange(change) {
      this.value = Number(change);
      this.calculateHealthAfterTransaction();
    },

    textInputChange(change) {
      console.log(change);
    },

    setupValidators() {

    },

  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";


.image-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

</style>