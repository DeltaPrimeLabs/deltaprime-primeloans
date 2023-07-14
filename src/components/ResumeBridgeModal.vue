<template>
  <div id="modal" class="resume-bridge-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Active Bridge Transfer 
      </div>
      <div class="modal-top-desc">
        <b>You have uncompleted Bridge Transactions<span v-if="execution && execution.status !== 'FAILED'"> in progress</span>.</b>
      </div>
      <div class="modal-top-info">
        {{ fromTokenData }}
        <DeltaIcon
          class="arrow"
          :icon-src="'src/assets/icons/arrow.svg'"
          :size="20"
        ></DeltaIcon>
        {{ toTokenData }}
      </div>

      <template v-if="execution && execution.status === 'FAILED'">
        <div class="button-wrapper button-group">
          <Button
            :label="'Resume'" v-on:click="resumeTransfer()"
          ></Button>
          <Button
            :label="'Delete'" v-on:click="deleteTransfer()"
          ></Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import Button from './Button';
import { formatUnits } from 'ethers/lib/utils';
import DeltaIcon from './DeltaIcon';

export default {
  name: 'DepositModal',
  components: {
    Button,
    Modal,
    DeltaIcon
  },

  props: {
    route: null,
    targetSymbol: null,
    depositNativeToken: null,
    lifiData: null,
    depositFunc: null
  },

  data() {
    return {
      activeRoute: null,
      execution: null,
      fromData: null,
      toData: null
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupRoute();
    });
  },

  computed: {
    fromTokenData() {
      if (!this.fromData) return;
      return `${this.fromData.fromAmount} ${this.fromData.fromToken.symbol} on ${this.fromData.fromChain.name}`;
    },

    toTokenData() {
      if (!this.toData) return;
      return `${this.toData.toAmount} ${this.toData.toToken.symbol} on ${this.toData.toChain.name}`;
    }
  },

  methods: {
    setupRoute() {
      this.activeRoute = this.route;
      this.execution = this.route.steps[0].execution;

      this.fromData = {
        fromAmount: formatUnits(this.route.fromAmount, this.route.fromToken.decimals),
        fromAmountUSD: this.route.fromAmountUSD,
        fromChain: this.lifiData.chains.find((chain => chain.id === Number(this.route.fromChainId))),
        fromToken: this.route.fromToken,
      };
      this.toData = {
        toAmount: formatUnits(this.route.toAmount, this.route.toToken.decimals),
        toAmountUSD: this.route.toAmountUSD,
        toChain: this.lifiData.chains.find((chain => chain.id === Number(this.route.toChainId))),
        toToken: this.route.toToken,
      };

      if (this.execution && this.execution.status !== 'FAILED') {
        this.resumeTransfer(true);
      }
    },

    async resumeTransfer(inProgress = false) {
      if (!inProgress) this.closeModal();

      try {
        const transferRes = await this.lifiService.resumeRoute(this.lifiData.lifi, this.activeRoute, this.progressBarService, this.depositFunc, {
          targetSymbol: this.targetSymbol,
          depositNativeToken: this.depositNativeToken
        });

        this.$emit('BRIDGE_DEPOSIT_RESUME', transferRes);
      } catch (error) {
        if (error.code === 4001 || error.code === -32603) {
          this.progressBarService.emitProgressBarCancelledState();
        } else {
          this.progressBarService.emitProgressBarErrorState();
        }
      }
    },

    deleteTransfer() {
      localStorage.setItem('active-bridge-deposit', '');
      this.lifiService.removeRoute(this.lifiData.lifi, this.activeRoute);
      this.closeModal();
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.arrow {
  background: var(--icon-button__icon-color--default);
  margin: 0 10px;
}

.button-group {
  justify-content: space-evenly;
}

</style>