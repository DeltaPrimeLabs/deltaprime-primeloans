<template>
  <div class="wallet">
    <img class="logo" src="src/assets/icons/avax-icon.svg"/>
    <div class="network">{{network}}</div>
    <div class="prime-account" v-if="hasSmartLoanContract">
      <div class="separator"></div>
      <img class="logo" src="src/assets/logo/deltaprime.svg"/>
      <div class="account"  v-tooltip="{content: 'Your Prime Account address', classes: 'info-tooltip long'}">
        <a :href="`https://snowtrace.io/address/${smartLoanContract.address}`" target="_blank">{{ smartLoanContract.address | tx(true) }}</a></div>
    </div>
    <div class="separator"></div>
    <img class="logo" src="src/assets/logo/metamask.svg"/>
    <div class="account" v-tooltip="{content: 'Your Metamask address', classes: 'info-tooltip long'}">
      <a :href='`https://snowtrace.io/address/${account}`' target="_blank">{{ account | tx(true) }}</a>
    </div>
    <div class="balance">{{ accountBalance | avax }}</div>
    <img class="logo" src="src/assets/icons/avax-icon.svg"/>
    <div class="separator"></div>
    <IconButton :disabled="!account || !notifiScreenLoaded"
                ref="notifiBtn"
                class="alert-icon"
                :icon-src="'src/assets/icons/alert_icon.svg'" :size="20"
                v-tooltip="{content: 'Notifications', classes: 'info-tooltip'}"
                @click="showModal = !showModal">
    </IconButton>
    <NotifiModal
      :show="showModal"
      @currentScreen="handleCurrentScreen"
      v-closable:dirArg
    >
    </NotifiModal>
  </div>
</template>


<script>
  import { mapState } from "vuex";
  import IconButton from "./IconButton.vue";
  import NotifiModal from "./notifi/NotifiModal.vue";
  const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

  export default {
    name: 'Wallet',
    components: {
      IconButton,
      NotifiModal
    },
    computed: {
      ...mapState('network', ['provider', 'account', 'accountBalance']),
      ...mapState('fundsStore', ['smartLoanContract', 'noSmartLoan']),
      ...mapState('serviceRegistry', ['notifiService']),
      network() {
        return 'Avalanche';
      },
      hasSmartLoanContract() {
        return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
      },
    },
    data() {
      return {
        showModal: false,
        notifiScreenLoaded: false,
        notifi: null,
        dirArg: {
          exclude: ['notifiBtn', 'notifiScreen'],
          handler: 'handleClose',
          currentScreen: null
        }
      }
    },
    mounted() {
      this.watchNotifi();
      this.watchNotifiCurrentScreen();
    },
    methods: {
      watchNotifi() {
        this.notifiService.observeNotifi().subscribe((notifi) => {
          this.notifi = notifi;
        });
      },

      handleClose() {
        this.showModal = false;
        this.notifiService.refreshClientInfo(this.notifi.client);
      },

      watchNotifiCurrentScreen() {
        this.notifiService.observeCurrentScreen().subscribe(() => {
          this.notifiScreenLoaded = true;
        });
      },

      handleCurrentScreen(screen) {
        this.dirArg = {
          ...this.dirArg,
          currentScreen: screen
        };
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.wallet {
  display: flex;
  font-weight: 500;
  font-size: 14px;
  position: relative;

  @media screen and (max-width: $md) {
    font-size: initial;
  }

  a {
    color: var(--wallet-a-color);
  }

  .balance {
    margin-right: 6px;
    margin-left: 6px;
  }

  .prime-account {
    display: flex;
  }
}

.account {
  font-weight: 500;
}

.logo {
  height: 16px;
  vertical-align: middle;
  margin-right: 5px;
  transform: translateY(2px);
}

.separator {
  width: 2px;
  height: 25px;
  flex-grow: 0;
  margin: 0 13px 0 14px;
  transform: translateY(-2px);
  border: solid 1px var(--wallet-separator-color);
}

.alert-icon {
  cursor: pointer;
  margin-right: 5px;
  transform: translateY(-2px);
}
</style>

