<template>
  <div class="progress-bar-component" v-if="progressBarVisible">
    <div class="background"
         v-bind:class="{'background--success': state === 'SUCCESS', 'background--error': state === 'ERROR', 'background--cancelled': state === 'CANCELLED'}"></div>
    <div v-if="state === 'IN_PROGRESS' || state === 'MINING'"
         class="value-overlay"
         v-bind:class="{'value-overlay__clock-running': state === 'IN_PROGRESS'}"
         v-bind:style="state === 'IN_PROGRESS' ? {'transition': `width ${duration}ms linear`} : {'transition': `width 0s linear`}"></div>
    <div class="text-overlay">
      <div v-if="state === 'MINING'" class="text-overlay__text text-overlay__in-progress">Waiting for confirmation...</div>
      <div v-if="state === 'IN_PROGRESS' && !statusInfo" class="text-overlay__text text-overlay__in-progress">Waiting for confirmation...</div>
      <div v-if="state === 'IN_PROGRESS' && statusInfo && statusInfo.message" class="text-overlay__text text-overlay__in-progress">
        <div v-if="statusInfo.message">{{ statusInfo.message }}<span v-if="estimatedDuration">{{ estimatedDurationInFormat }}</span>&nbsp; </div>
        <div>Check status <span class="btn-hover" @click="openResumeBridgeModal">here</span></div>
      </div>
      <div v-if="state === 'SUCCESS'" class="text-overlay__text text-overlay__success">
        Success
        <DeltaIcon class="text-overlay__icon" :icon-src="'src/assets/icons/tick-white.svg'" :size="20"></DeltaIcon>
      </div>
      <div v-if="state === 'ERROR'" class="text-overlay__text text-overlay__error">
        Transaction Failed <span v-if="additionalInfo"> {{additionalInfo}}</span>
        <DeltaIcon class="text-overlay__icon" :icon-src="'src/assets/icons/x-white.svg'" :size="20"></DeltaIcon>
      </div>
      <div v-if="state === 'CANCELLED'" class="text-overlay__text text-overlay__cancelled">
        Transaction Cancelled
        <DeltaIcon class="text-overlay__icon" :icon-src="'src/assets/icons/x-white.svg'" :size="20"></DeltaIcon>
      </div>
    </div>
  </div>
</template>

<script>
import {mapActions, mapState} from 'vuex';
import {delay, interval, startWith, timer, combineLatest} from 'rxjs';
import DeltaIcon from "./DeltaIcon.vue";
import ResumeBridgeModal from './ResumeBridgeModal';
import moment from 'moment';

export default {
  name: 'ProgressBar',
  components: {DeltaIcon},
  data() {
    return {
      value: 0,
      progressBarVisible: false,
      clock: null,
      success: false,
      error: false,
      state: 'IN_PROGRESS',
      duration: 0,
      additionalInfo: null,
      statusInfo: null,
      estimatedDuration: null,
      timer: null
    };
  },
  computed: {
    ...mapState('serviceRegistry', ['progressBarService', 'lifiService']),
    ...mapState('network', ['account', 'accountBalance', 'provider']),

    estimatedDurationInFormat() {
      const formatString = 'D [days], H [hours], m [minutes], s [seconds]';
      return this.estimatedDuration <= 0 ? "In progress" : moment.duration(this.estimatedDuration, 'seconds').format(formatString);
    },
  },
  mounted() {
    this.watchProgressBarRequest();
  },
  methods: {
    ...mapActions('poolStore', ['deposit']),

    watchProgressBarRequest() {
      this.progressBarService.progressBarRequested$.subscribe((progressBarRequest) => {
        if (!this.progressBarVisible) {
          this.value = 0;
          this.duration = progressBarRequest.duration;
          this.showProgressBar(progressBarRequest.duration);
        }
      });
    },

    watchProgressBarState() {
      this.progressBarService.progressBarState$.subscribe((stateChangeEvent) => {
        this.state = stateChangeEvent.state;
        this.additionalInfo = stateChangeEvent.additionalInfo;
        this.statusInfo = stateChangeEvent.statusInfo;
        const duration = stateChangeEvent.duration ? stateChangeEvent.duration : 3000

        const history = JSON.parse(localStorage.getItem('active-bridge-deposit'));
        const remainingDuration = history && history[this.account.toLowerCase()].remainingDuration;

        if (stateChangeEvent.state == 'IN_PROGRESS' && stateChangeEvent.statusInfo) this.estimatedDuration = remainingDuration ? remainingDuration : stateChangeEvent.statusInfo.estimatedDuration;

        if (this.progressBarVisible) {
          if (this.state === 'SUCCESS' || this.state === 'ERROR' || this.state === 'CANCELLED') {
            timer(duration).subscribe(() => {
              this.progressBarVisible = false;
            });
          }
        }
      });
    },

    watchActiveRoute() {
      this.lifiService.observeLifi()
        .subscribe(async (lifiData) => {
          this.lifiData = lifiData;

          const history = JSON.parse(localStorage.getItem('active-bridge-deposit'));

          this.activeTransfer = history && history[this.account.toLowerCase()];
        });
    },

    showProgressBar(duration) {
      this.progressBarVisible = true;
      this.state = 'MINING';
      setTimeout(() => {
        this.value = 0;
        this.clock = timer(duration).subscribe(() => {
          // clock finished
        });
      });
    },

    openResumeBridgeModal() {
      if (this.lifiService.modalOpened) return;
      const modalInstance = this.openModal(ResumeBridgeModal);
      modalInstance.account = this.account;
      modalInstance.activeTransfer = this.activeTransfer;
      modalInstance.lifiData = this.lifiData;
      modalInstance.lifiService = this.lifiService;
      modalInstance.progressBarService = this.progressBarService;
      modalInstance.depositFunc = this.deposit;
      modalInstance.$on('BRIDGE_DEPOSIT_RESUME', (transferRes) => {
        if (!transferRes) return;
        // const pools = this.poolsList.map(pool => {
        //   return {
        //     ...pool,
        //     deposit: pool.asset.symbol === this.activeTransfer.targetSymbol
        //       ? Number(pool.deposit) + Number(transferRes.amount)
        //       : pool.deposit
        //   };
        // });

        // this.poolsList = pools;
      });
    },
  },

  watch: {
    account: {
      handler(value) {
        if (value) {
          this.watchActiveRoute();
          this.watchProgressBarState();
        }
      }
    },

    estimatedDuration: {
      handler(value) {
        if (value > 0 && this.lifiService.countStart) {

          clearTimeout(this.timer);
          this.timer = setTimeout(() => {
            const history = JSON.parse(localStorage.getItem('active-bridge-deposit'));

            if (this.estimatedDuration) {
              history[this.account.toLowerCase()].remainingDuration = this.estimatedDuration;
              localStorage.setItem('active-bridge-deposit', JSON.stringify(history));
            }

            this.estimatedDuration--;
          }, 1000);
        }
      },
      immediate: true
    }
  }
};
</script>

<style scoped lang="scss">
@import "~@/styles/variables";

.progress-bar-component {
  position: fixed;
  z-index: 3;
  bottom: 36px;
  left: 0;
  height: 36px;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  .background {
    position: absolute;
    width: 100%;
    height: 100%;
    background-image: var(--progress-bar__background);

    &.background--success {
      background: var(--progress-bar__background--success);
    }

    &.background--error {
      background: var(--progress-bar__background--error);
    }

    &.background--cancelled {
      background: var(--progress-bar__background--cancelled);
    }
  }

  .value-overlay {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 67%;
    height: 100%;
    background-color: var(--progress-bar__value-overlay-background);

    &.value-overlay__clock-running {
      width: 0;
    }
  }

  .text-overlay {
    height: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    font-size: $font-size-sm;
    z-index: 1;

    .text-overlay__text {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 3px;

      &.text-overlay__in-progress {
        border-radius: 54px;
        background-color: var(--progress-bar__text-overlay-background);
        color: var(--progress-bar__text-overlay-color);
        font-weight: 600;
        padding: 1px 10px;

        .text-overlay__icon {
          background: var(--progress-bar__text-overlay-color);
        }
        
        .btn-hover {
          color: var(--progress-bar__text-overlay-btn-hover-color);
          cursor: pointer;
        }
      }

      &.text-overlay__success, &.text-overlay__error, &.text-overlay__cancelled {
        color: var(--progress-bar__text-overlay-color--finished);
        font-weight: bold;

        .text-overlay__icon {
          background: var(--progress-bar__text-overlay-color--finished);
        }
      }
    }
  }
}
</style>
