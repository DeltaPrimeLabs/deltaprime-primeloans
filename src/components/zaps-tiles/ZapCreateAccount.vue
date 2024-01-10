<template>
  <ZapTile v-on:tileClick="onTileClick()" :img-src="'src/assets/icons/chart-up.png'" :dark-img-src="'src/assets/icons/chart-up--dark.png'" :header="'Create Account'">
    <template #label>
      Start <b>here</b>
    </template>
    <template #default>
    </template>
  </ZapTile>
</template>

<script>
import {mapActions, mapState} from 'vuex';
import config from '../../config';
import erc20ABI from '../../../test/abis/ERC20.json';
import {combineLatest} from 'rxjs';
import ZapTile from "./ZapTile.vue";
import CreateAccountModal from "../CreateAccountModal.vue";

const ethers = require('ethers');


export default {
  name: 'ZapCreateAccount',
  components: {ZapTile},
  data() {
    return {
    };
  },

  computed: {
    ...mapState('fundsStore', [
    ]),
    ...mapState('network', ['provider', 'account', 'accountBalance']),
    ...mapState('serviceRegistry', [
      'progressBarService'
    ]),
  },

  async mounted() {
  },

  methods: {
    ...mapActions('fundsStore',
        [
          'swap',
          'fund',
          'borrow',
        ]),

    async onTileClick() {
      const modalInstance = this.openModal(CreateAccountModal);

      modalInstance.walletBalances = this.getWalletBalances();
      modalInstance.assets = Object.keys(config.ASSETS_CONFIG).filter(el => !el.inactive);
      modalInstance.asset = config.ASSETS_CONFIG[config.nativeToken];

      this.$forceUpdate();

      modalInstance.$on('ZAP_CREATE_ACCOUNT_EVENT', async createAccountEvent => {
        const fundRequest = {
          value: createAccountEvent.value,
          asset: createAccountEvent.token,
          assetDecimals: config.ASSETS_CONFIG[createAccountEvent.token].decimals,
          type: 'ASSET',
        };
        this.handleTransaction(this.fund, {fundRequest: fundRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    getWalletBalances() {
      const tokens = Object.values(config.ASSETS_CONFIG).map(asset => asset.symbol);

      return combineLatest(
          tokens.map(token => {
                const contract = new ethers.Contract(config.ASSETS_CONFIG[token].address, erc20ABI, this.provider.getSigner());
                return this.getWalletTokenBalance(
                    this.account,
                    token,
                    contract,
                    config.ASSETS_CONFIG[token].decimals
                );
              }
          )
      );
    },
  }
};
</script>

<style scoped>

</style>
