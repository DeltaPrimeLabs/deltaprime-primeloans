<template>
  <div id="modal" class="rebalance-sprime-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Rebalance sPRIME
        <img class="sprime-logo"
             v-if="secondAssetSymbol"
             :src="`src/assets/logo/sprime-${secondAssetSymbol.toLowerCase()}.svg`"/>
      </div>

      <div class="modal-top-info-bar">
        <div>
          Rebalancing will center your sPRIME around the current price.
        </div>
      </div>

      <SlippageControl :slippage-margin="0.02" v-on:slippageChange="slippageChange"></SlippageControl>

      <div class="button-wrapper">
        <Button :label="'REBALANCE'" v-on:click="submit()"
                :waiting="transactionOngoing"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import Button from './Button';
import DoubleAssetIcon from "./DoubleAssetIcon.vue";
import SlippageControl from './SlippageControl.vue';

export default {
  name: 'RebalancesPrimeModal',
  components: {
    SlippageControl,
    DoubleAssetIcon,
    Button,
    Modal,
  },

  props: {
    secondAssetSymbol: null
  },

  data() {
    return {
      transactionOngoing: false,
      slippage: 0,
    };
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const rebalanceSPrimeEvent = {
        slippage: this.slippage
      };
      this.$emit('REBALANCE', rebalanceSPrimeEvent);
    },

    slippageChange(slippageChangeEvent) {
      console.log(slippageChangeEvent);
      this.slippage = slippageChangeEvent;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.rebalance-sprime-modal-component {

  .modal__title {
    margin-bottom: 0 !important;

    .sprime-logo {
      margin-left: 10px;
      width: 40px;
    }
  }

  .modal-top-desc {
    margin-top: 25px;
    margin-bottom: 25px;
    .rewards-info {
      text-align: center;
      line-height: 20px;
    }
  }

  .rewards {
    margin-top: 40px;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    color: var(--modal__top-info-color);

    .rewards__label {
      font-weight: 400;
      margin-right: 5px;
    }

    .rewards__value {
      font-weight: 600;
      display: flex;

      .rewards__reward-token {
        text-align: center;

        &:not(:first-child) {
          margin-left: 15px;
        }

        .asset__icon {
          width: 20px;
          height: 20px;
          opacity: var(--asset-table-row__icon-opacity);
        }
      }
    }
  }

  .modal-top-info-bar {
    margin-top: 50px;
    margin-bottom: 50px;
  }
}

</style>
