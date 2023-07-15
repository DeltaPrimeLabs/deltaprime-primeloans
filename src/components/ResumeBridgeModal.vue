<template>
  <div id="modal" class="resume-bridge-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Active Bridge Transfer 
      </div>
      <div class="modal-top-desc">
        <b>You have uncompleted Bridge Transactions<span v-if="!cancelled && execution && execution.status !== 'FAILED'"> in progress</span>.</b>
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

      <template v-if="cancelled || execution && execution.status === 'FAILED'">
        <div class="button-wrapper button-group">
          <Button
            :label="'Resume'"
            v-on:click="resumeTransfer()"
            :disabled="isLoading"
          ></Button>
          <Button
            :label="'Delete'"
            v-on:click="deleteTransfer()"
            :disabled="isLoading"
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
    lifiData: null,
    depositFunc: null
  },

  data() {
    return {
      route: null,
      targetSymbol: null,
      depositNativeToken: null,
      cancelled: false,
      execution: null,
      fromData: null,
      toData: null,
      isLoading: false
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
      return `${Number(this.fromData.fromAmount).toFixed(4)} ${this.fromData.fromToken.symbol} on ${this.fromData.fromChain.name}`;
    },

    toTokenData() {
      if (!this.toData) return;
      return `${Number(this.toData.toAmount).toFixed(4)} ${this.toData.toToken.symbol} on ${this.toData.toChain.name}`;
    }
  },

  methods: {
    setupRoute() {
      const activeTransfer = localStorage.getItem('active-bridge-deposit');
      const { route, targetSymbol, depositNativeToken, cancelled } = JSON.parse(activeTransfer);

      this.route = route;
      this.targetSymbol = targetSymbol;
      this.depositNativeToken = depositNativeToken;
      this.cancelled = cancelled;      
      this.execution = route.steps[0].execution;

      this.fromData = {
        fromAmount: formatUnits(route.fromAmount, route.fromToken.decimals),
        fromAmountUSD: route.fromAmountUSD,
        fromChain: this.lifiData.chains.find((chain => chain.id === Number(route.fromChainId))),
        fromToken: route.fromToken,
      };
      this.toData = {
        toAmount: formatUnits(route.toAmount, route.toToken.decimals),
        toAmountUSD: route.toAmountUSD,
        toChain: this.lifiData.chains.find((chain => chain.id === Number(route.toChainId))),
        toToken: route.toToken,
      };

      if (!cancelled && this.execution && this.execution.status !== 'FAILED') {
        this.resumeTransfer();
      }
    },

    async resumeTransfer() {
      this.isLoading = true;

      try {
        const transferRes = await this.lifiService.resumeRoute(this.lifiData.lifi, this.route, this.progressBarService, this.depositFunc, {
          targetSymbol: this.targetSymbol,
          depositNativeToken: this.depositNativeToken
        });

        this.$emit('BRIDGE_DEPOSIT_RESUME', transferRes);
      } catch (error) {
        if (error.code === 4001 || error.code === -32603) {
          this.progressBarService.emitProgressBarCancelledState();

          const activeBridge = localStorage.getItem('active-bridge-deposit');
          localStorage.setItem('active-bridge-deposit', JSON.stringify({
            ...JSON.parse(activeBridge),
            cancelled: true
          }));
        } else {
          this.progressBarService.emitProgressBarErrorState();
        }
      }

      this.closeModal();
      this.isLoading = false;
    },

    deleteTransfer() {
      localStorage.setItem('active-bridge-deposit', '');
      this.lifiService.removeRoute(this.lifiData.lifi, this.route);
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