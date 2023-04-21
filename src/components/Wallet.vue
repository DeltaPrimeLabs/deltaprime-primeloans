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
    <IconButton :disabled="!account"
                class="alert-icon"
                :icon-src="'src/assets/icons/alert_icon.svg'" :size="16"
                v-tooltip="{content: 'Notifications', classes: 'info-tooltip'}"
                v-on:click="actionClick('OPEN')">
    </IconButton>
  </div>
</template>


<script>
  import { mapState, mapActions } from "vuex";
  import IconButton from "./IconButton.vue";
  const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

  export default {
    name: 'Wallet',
    props: {
      title: String
    },
    components: {
      IconButton,
    },
    computed: {
      ...mapState('network', ['provider', 'account', 'accountBalance']),
      ...mapState('fundsStore', ['smartLoanContract', 'noSmartLoan']),
      ...mapState('notifiStore', ['notifiAuthenticated', 'targetGroups']),
      network() {
        return 'Avalanche';
      },
      hasSmartLoanContract() {
        return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
      },
    },
    data() {
      return {

      }
    },
    methods: {
      ...mapActions('notifiStore', ['initAuth', 'createAlert', 'createTargetGroups']),
      actionClick(key) {
        switch (key) {
          case 'OPEN':
            if (!this.notifiAuthenticated) {
              // show initial screen to connect to notifi
            } else if(!this.targetGroups || this.targetGroups.length == 0) {
              // show destinations setup screen
            } else {
              // show main screen
            }
            this.handleNotifi();
            break;
          case 'LOGIN':
            this.initAuth();
            break;
          case 'CREATE': 
            this.createAlert();
            break;
        }
      },
      async handleNotifi() {
        await this.initAuth();

        const targetPayload = {
          name: 'Default',
          emailAddress: 'willie.lee226@gmail.com'
        };
        await this.createTargetGroups({ targetPayload });

        const eventType = {
          name: 'Loan Health Alerts',
          filterType: 'DELTA_PRIME_LENDING_HEALTH_EVENTS',
          selectedUIType: "HEALTH_CHECK",
          alertFrequency: 'DAILY',
          checkRatios: [{ type: 'below', value: 90 }],
        };

        const inputs = {
          ['Loan Health Alerts__healthRatio']: 90, // in percent, like 100
        };

        await this.createAlert({ eventType, inputs });
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
  &:hover {
    transform: scale(1.2);
  }
}
</style>

