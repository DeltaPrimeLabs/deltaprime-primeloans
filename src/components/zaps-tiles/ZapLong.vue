<template>
  <div class="zap-tile" @click="onTileClick()">
    <div class="label">
      up to <b>5x</b>
    </div>
    <div class="header">Long</div>
    <div class="icons">
      <img class="icon" v-for="icon in tokenIcons" :src="icon">
    </div>
    <div class="more-label">...and more!</div>
    <img class="image" src="src/assets/icons/chart-up.png">
  </div>
</template>

<script>
import ZapLongModal from '../zaps-modals/ZapLongModal.vue';
import {mapActions, mapState} from 'vuex';
import config from '../../config';
import erc20ABI from '../../../test/abis/ERC20.json';
import {combineLatest} from 'rxjs';
import YAK_ROUTER_ABI from '../../../test/abis/YakRouter.json';
import YAK_WRAP_ROUTER from '../../../artifacts/contracts/interfaces/IYakWrapRouter.sol/IYakWrapRouter.json';
import {parseUnits} from '../../utils/calculate';
import {BigNumber} from 'ethers';

const ethers = require('ethers');

let TOKEN_ADDRESSES;

export default {
  name: 'ZapLong',
  data() {
    return {
      tokenIcons: []
    };
  },

  computed: {
    ...mapState('fundsStore', [
      'health',
      'assetBalances',
      'debtsPerAsset',
      'assets',
      'lpAssets',
      'concentratedLpAssets',
      'lpBalances',
      'concentratedLpBalances',
      'fullLoanStatus'
    ]),
    ...mapState('stakeStore', ['farms']),
    ...mapState('network', ['provider', 'account', 'accountBalance']),
  },

  async mounted() {
    await this.setupFiles();
    this.setupLogos();
  },

  methods: {
    ...mapActions('fundsStore',
      [
        'swap',
        'fund',
        'borrow',
      ]),

    async setupFiles() {
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },

    setupLogos() {
      this.tokenIcons = Object.values(config.ASSETS_CONFIG).filter(asset => !asset.isStableCoin).map(asset => this.logoSrc(asset.symbol)).slice(0,6)
    },

    async onTileClick() {
      console.log('tile click');
      console.log(this.assetBalances);
      const stableCoins = Object.values(config.ASSETS_CONFIG).filter(asset => asset.isStableCoin).map(asset => asset.symbol);
      const stableCoinsWalletBalances = {};
      this.getStableCoinsWalletBalances(stableCoins).subscribe(balances => {
        console.log(balances);
        stableCoins.forEach((coin, index) => {
          stableCoinsWalletBalances[coin] = balances[index];
        });
        console.log(stableCoinsWalletBalances);
        const modalInstance = this.openModal(ZapLongModal);

        modalInstance.assets = this.assets;
        modalInstance.assetBalances = this.assetBalances;
        modalInstance.lpAssets = this.lpAssets;
        modalInstance.concentratedLpAssets = this.concentratedLpAssets;
        modalInstance.lpBalances = this.lpBalances;
        modalInstance.concentratedLpBalances = this.concentratedLpBalances;
        modalInstance.farms = this.farms;
        modalInstance.debtsPerAsset = this.debtsPerAsset;
        modalInstance.debt = this.fullLoanStatus.debt;
        modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue;

        modalInstance.stableCoinsWalletBalances = stableCoinsWalletBalances;
        modalInstance.accountAssetBalances = this.assetBalances;

        this.$forceUpdate();

        modalInstance.$on('ZAP_LONG_EVENT', async zapLongEvent => {
          console.log(zapLongEvent);
          const totalLongValue = Number(zapLongEvent.stableCoinAmount) * Number(zapLongEvent.leverage);
          const borrowRequest = {
            asset: zapLongEvent.stableCoin,
            amount: Number(zapLongEvent.stableCoinAmount) * (zapLongEvent.leverage - 1)
          };
          const stableCoinDecimals = config.ASSETS_CONFIG[zapLongEvent.stableCoin].decimals;
          const totalLongValueInWei = parseUnits(totalLongValue.toFixed(stableCoinDecimals), BigNumber.from(stableCoinDecimals));
          const swapQueryResponse = await this.yakSwapQueryMethod()(zapLongEvent.stableCoin, zapLongEvent.longAsset, totalLongValueInWei);
          console.log(swapQueryResponse);

          const swapRequest = {
            sourceAsset: zapLongEvent.stableCoin,
            targetAsset: zapLongEvent.longAsset,
            sourceAmount: (Number(zapLongEvent.stableCoinAmount) * zapLongEvent.leverage).toString(),
            targetAmount: 0,
            path: swapQueryResponse.path,
            adapters: swapQueryResponse.adapters,
            swapDex: 'YakSwap'
          };

          if (zapLongEvent.depositAmount) {
            const fundRequest = {
              value: parseFloat(zapLongEvent.depositAmount).toFixed(stableCoinDecimals),
              asset: zapLongEvent.stableCoin,
              assetDecimals: config.ASSETS_CONFIG[zapLongEvent.stableCoin].decimals,
              type: 'ASSET'
            };
            await this.handleTransaction(this.fund, {fundRequest: fundRequest}, () => {
            });
          }
          await this.handleTransaction(this.borrow, {borrowRequest: borrowRequest}, () => {
            console.log('inside borrow callback');
          });
          console.log('after borrow');
          await this.handleTransaction(this.swap, {swapRequest: swapRequest}, () => {

          });


        });
      });
    },

    getStableCoinsWalletBalances(stableCoins) {
      return combineLatest(
        stableCoins.map(stableCoin => {
            const contract = new ethers.Contract(config.ASSETS_CONFIG[stableCoin].address, erc20ABI, this.provider.getSigner());
            return this.getWalletTokenBalance(
              this.account,
              stableCoin,
              contract,
              config.ASSETS_CONFIG[stableCoin].decimals
            );
          }
        )
      );
    },

    yakSwapQueryMethod() {
      return async (sourceAsset, targetAsset, amountIn) => {
        console.log('TOKEN_ADDRESSES');
        console.log(TOKEN_ADDRESSES);
        console.log(sourceAsset);
        console.log(targetAsset);
        const tknFrom = config.ASSETS_CONFIG[sourceAsset].address;
        const tknTo = config.ASSETS_CONFIG[targetAsset].address;

        const yakRouter = new ethers.Contract(config.yakRouterAddress, YAK_ROUTER_ABI, provider.getSigner());
        console.log(yakRouter);

        const maxHops = 3;
        const gasPrice = ethers.utils.parseUnits('0.2', 'gwei');

        try {
          return await yakRouter.findBestPathWithGas(
            amountIn,
            tknFrom,
            tknTo,
            maxHops,
            gasPrice,
            {gasLimit: 1e9}
          );
        } catch (e) {
          console.error(e);
        }
      };
    },
  }
};
</script>

<style scoped>
.zap-tile {
    box-shadow: var(--zap-long__zap-tile-shadow);
    border-radius: 16px;
    padding: 48px 64px 32px 64px;
    position: relative;
    cursor: pointer;
    transition: box-shadow 200ms ease-in-out;

    &:hover {
        box-shadow: var(--zap-long__zap-tile-shadow--hover);
    }
}

.label {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 0 0 8px 8px;
    background: var(--zap-long__label-background-color);
    color: var(--zap-long__label-color);
    padding: 4px;
}

.header {
    text-align: center;
    font-size: 18px;
    color: var(--zap-long__header-color);
    font-weight: 700;
    margin-bottom: 16px;
}

.icons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, 1fr);
    grid-column-gap: 16px;
    grid-row-gap: 16px;
    width: 116px;
    height: 72px;
    margin-bottom: 8px;
    user-select: none;
}

.icon {
    height: 100%;
}

.more-label {
    text-align: center;
}

.image {
    width: 118px;
    height: 118px;
    margin-top: 32px;
    user-select: none;
}

</style>
