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
      <div class="modal-top-info">
        Estimated Duration: {{ estimatedDuration ? estimatedDuration : '-' }}
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
import { ethers } from 'ethers';
import moment from 'moment';

export default {
  name: 'ResumeBridgeModal',
  components: {
    Button,
    Modal,
    DeltaIcon
  },

  props: {
    account: null,
    activeTransfer: null,
    lifiData: null,
    depositFunc: null
  },

  data() {
    return {
      route: null,
      targetSymbol: null,
      depositNativeToken: null,
      disableDeposit: false,
      cancelled: false,
      execution: null,
      fromData: null,
      toData: null,
      isLoading: false,
      estimatedDuration: null
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupRoute();
      this.getEstimatedDuration();
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
    },
  },

  methods: {
    setupRoute() {
      const { route, targetSymbol, depositNativeToken, disableDeposit, cancelled } = this.activeTransfer;

      this.route = route;
      this.targetSymbol = targetSymbol;
      this.depositNativeToken = depositNativeToken;
      this.disableDeposit = disableDeposit;
      this.cancelled = cancelled;      

      let execution;
      route.steps.map((step) => {
        if (step.execution) execution = step.execution;
      })
      this.execution = execution;

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
        const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
        const signer= provider.getSigner();
        const bridgeRequest = {
          lifi: this.lifiData.lifi,
          chosenRoute: this.route,
          depositNativeToken: this.depositNativeToken,
          signer: signer,
          depositFunc: this.depositFunc,
          targetSymbol: this.targetSymbol,
          disableDeposit: this.disableDeposit
        }
        const transferRes = await this.lifiService.bridgeAndDeposit({
          bridgeRequest,
          progressBarService: this.progressBarService,
          resume: true
        });

        this.$emit('BRIDGE_DEPOSIT_RESUME', transferRes);
      } catch (error) {
        console.log(error);
        if (error.code === 4001 || error.code === -32603) {
          this.progressBarService.emitProgressBarCancelledState();

          const history = JSON.parse(localStorage.getItem('active-bridge-deposit'));
          const userKey = this.account.toLowerCase();
          const updatedHistory = {
            ...history,
            [userKey]: {
              ...history[userKey],
              cancelled: true
            }
          };

          localStorage.setItem('active-bridge-deposit', JSON.stringify(updatedHistory));
        } else {
          const { route } = JSON.parse(this.activeTransfer);
          const statusInfo = this.lifiService.getStatusInfo(route);
          this.progressBarService.emitProgressBarErrorState(statusInfo);
        }
      }

      this.closeModal();
      this.isLoading = false;
    },

    getEstimatedDuration() {
      const formatString = 'D [days], H [hours], m [minutes], s [seconds]';
      const estimatedDuration = this.lifiService.getEstimatedDuration(this.route);
      this.estimatedDuration = moment.duration(estimatedDuration, 'seconds').format(formatString);
    },

    deleteTransfer() {
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