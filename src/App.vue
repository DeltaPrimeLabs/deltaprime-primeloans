<template>
  <div class="page-content">
    <!--    <button v-on:click="testClick()">test</button>-->
    <Banner v-if="showNetworkBanner">
      You are connected to a wrong network. Please change to Avalanche or Arbitrum.
    </Banner>
    <Banner v-if="showNoWalletBanner">
      You have no wallet installed. Please download and activate
      <a class="banner-link" href="https://chrome.google.com/webstore/detail/rabby-wallet/acmacodkjbdgmoleebolmdjonilkdbch" target="_blank">
        <b>
          Rabby
        </b>
      </a>
      or
      <a class="banner-link" href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn" target="_blank">
        <b>
          Metamask
        </b>
      </a>.
    </Banner>
    <Banner v-if="showConnectBanner">
      You are not connected to Metamask. <a class="banner-link" @click="initNetwork"><b>Click here</b></a> to connect.
    </Banner>
    <Banner v-if="showMetamaskBanner">
      Please download and activate
      <a class="banner-link" href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn" target="_blank"><b>Metamask
        plugin</b></a>.
    </Banner>
    <Banner v-if="highGasPrice && !showMetamaskBanner && !showNetworkBanner && !showUpgradeBanner" :closable="true">
      Gas prices are high at the moment. Be careful with your transactions.
    </Banner>
    <Banner v-if="protocolPaused">
      The protocol is paused because of an upgrade.
    </Banner>
    <Banner v-if="oracleError">
      Data feeds error. Some functions might be not available.
    </Banner>
    <Banner v-if="showArbitrumDepositorBanner" background="green-accent" :closable="true">
      Liquidity mining event is updated! Shortly after a pool hits $1M the next pool opens up.
      <a class="banner-link" href="https://medium.com/@Delta_Prime/relaunching-deltaprime-on-arbitrum-ac43bdd91ed5" target="_blank">
        <b>
          Read more.
        </b>
      </a>
    </Banner>
    <Banner v-if="showArbitrumPrimeAccountBanner" background="green-accent" :closable="true">
      Welcome to DeltaPrime Blue! In the coming weeks this page will significantly expand with partner protocols. Stay tuned!
    </Banner>
    <Banner v-if="showAvalancheDepositorBanner" background="green-accent" :closable="true">
      No DeltaPrime liquidity pools have been affected by the recent Platypus exploit. Read more in our Discord.
<!--      <a class="banner-link" href="" target="_blank">-->
<!--        <b>-->
<!--          Read more.-->
<!--        </b>-->
<!--      </a>-->
    </Banner>
    <Banner v-if="showAvalanchePrimeAccountBanner" background="green-accent" :closable="true">
      Platypus has temporarily paused withdrawals from their vaults. Read more in our Discord.
<!--      <a class="banner-link" href="" target="_blank">-->
<!--        <b>-->
<!--          Read more.-->
<!--        </b>-->
<!--      </a>-->
    </Banner>
    <div class="content">
      <div class="top-bar">
        <div class="top-bar__left-part">
          <a href="https://deltaprime.io/">
            <img src="src/assets/icons/deltaprime.svg" class="logo">
          </a>
          <ThemeToggle class="top-bar__theme-toggle"></ThemeToggle>
        </div>
        <!--      <div class="connect" v-if="!account" v-on:click="initNetwork()">Connect to wallet</div>-->
        <Wallet class="wallet"/>
      </div>
      <router-view></router-view>
      <ProgressBar></ProgressBar>
    </div>
  </div>

</template>


<script>
import Navbar from '@/components/Navbar.vue';
import Wallet from '@/components/Wallet.vue';
import Banner from '@/components/Banner';
import {mapActions, mapState} from 'vuex';
import config from '@/config';

const ethereum = window.ethereum;
import Vue from 'vue';
import Button from './components/Button';
import ProgressBar from './components/ProgressBar';
import PartnerInfoModal from './components/PartnerInfoModal';
import ThemeToggle from "./components/ThemeToggle.vue";
import {getCountdownString} from "./utils/calculate";

export default {
  components: {
    ThemeToggle,
    ProgressBar,
    Button,
    Navbar,
    Wallet,
    Banner
  },
  data: () => {
    return {
      showNetworkBanner: false,
      showMetamaskBanner: false,
      showConnectBanner: false,
      highGasPrice: false,
      gasPriceIntervalId: null,
      showGlpBanner: false,
      showDepositBanner: false,
      showPrimeAccountBanner: false,
      showArbitrumDepositorBanner: false,
      showArbitrumPrimeAccountBanner: false,
      showAvalancheDepositorBanner: false,
      showAvalanchePrimeAccountBanner: false,
      remainingTime: "",
      darkMode: false,
      showNoWalletBanner: window.noWalletInstalled,
    };
  },
  async created() {
    await this.initNetwork();

    if (!ethereum) {
      this.showMetamaskBanner = true;
      return;
    }

    if (await this.checkConnectedChain() !== config.chainId) {
      this.showNetworkBanner = true;
      return;
    }

    await this.metamaskChecks();

    if (!this.provider || !this.account) {
      this.showConnectBanner = true;
      return;
    }

    this.initGasPrices();

    if (window.location.href.includes('prime-account')) {
      this.showGlpBanner = true;
    }

    if (window.location.href.includes('pools')) {
      this.showDepositBanner = true;
    }

    if (window.location.href.includes('prime-account')) {
      this.showPrimeAccountBanner = true;
    }

    if (config.chainId === 42161) {
      if (window.location.href.includes('pools')) {
        this.showArbitrumDepositorBanner = true;
      }
      if (window.location.href.includes('prime-account')) {
        this.remainingTime = getCountdownString(1695218400000);
        this.showArbitrumPrimeAccountBanner = true;
      }
    }

    if (config.chainId === 43114) {
      if (window.location.href.includes('pools')) {
        this.showAvalancheDepositorBanner = true;
      }
      if (window.location.href.includes('prime-account')) {
        this.showAvalanchePrimeAccountBanner = true;
      }
    }
  },

  mounted() {
    setTimeout(() => {
      this.openModal(PartnerInfoModal)
    }, 2000)
    window.testProperty = 'test value'
    document.addEventListener('keyup', (event) => {
      if (event.key === 'Escape') {
        this.closeModal();
      }
    });
    this.watchCloseModal();
  },
  computed: {
    ...mapState('network', ['account', 'provider']),
    ...mapState('fundsStore', ['protocolPaused', 'oracleError']),
    ...mapState('serviceRegistry', ['modalService']),
  },
  methods: {
    ...mapActions('network', ['initNetwork']),
    async checkConnectedChain() {
      const chainId = await ethereum.request({method: 'eth_chainId'});

      ethereum.on('chainChanged', async () => {
        const chainId = await ethereum.request({method: 'eth_chainId'});
        location.reload();

        if (chainId == this.toHex(config.chainId)) {
          this.showNetworkBanner = false;
        } else {
          this.showNetworkBanner = true;
        }
      });

      return this.toDec(chainId);
    },
    async connectToProperChain() {
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{chainId: this.toHex(config.chainId)}],
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          let walletParams;
          switch (config.chainId) {
            case 2140:
              walletParams = {
                chainName: 'Forked Avalanche',
                chainId: this.toHex(config.chainId),
                rpcUrls: ['https://207.154.255.139/'],
                nativeCurrency: {
                  name: 'AVAX',
                  symbol: 'AVAX',
                  decimals: 18
                }
              };
              break;
            case 43114:
              walletParams = {
                chainName: 'Avalanche Mainnet C-Chain',
                chainId: this.toHex(config.chainId),
                rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
                nativeCurrency: {
                  name: 'AVAX',
                  symbol: 'AVAX',
                  decimals: 18
                }
              };
              break;
            case 43113:
              walletParams = {
                chainName: 'Avalanche FUJI C-Chain',
                chainId: this.toHex(config.chainId),
                rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
                nativeCurrency: {
                  name: 'AVAX',
                  symbol: 'AVAX',
                  decimals: 18
                }
              };
          }

          try {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [walletParams]
            });
          } catch (addError) {
            Vue.$toast.error('Error while adding network');
          }
        } else {
          Vue.$toast.error('Error while switching network');
        }
      }
    },
    async metamaskChecks() {
      window.ethereum.on('accountsChanged', function () {
        window.location.reload();
      });
    },
    initGasPrices() {
      this.gasPriceIntervalId = setInterval(async () => {
        this.checkGasPrices();
      }, 2000);
    },
    async checkGasPrices() {
      const resp = await fetch('https://gavax.blockscan.com/gasapi.ashx?apikey=key&method=gasoracle');
      const blockchainData = await resp.json();

      this.highGasPrice = parseInt(blockchainData.result.SafeGasPrice) > 150;
    },

    hasUnwindedGlp() {
      return ["0x2716f9dd4058b2e2023a79100795c1647f9a5cfa", "0xc991663FA798E5f27C854EE751285C23796EF6f6", "0xB0399dAC8f4D4100b49b2a7B3873481114229D18", "0x57356793365301b26bD8dA93a7249C92A2003b1D", "0xfb5845A7128149215a92B7dd01985C31EdA3A202", "0x76Ee7EE3C1B60e2bcA3Effb3d266BF0688BF4297", "0xfA713713B1ACd89A00e6b35512161630d5ea90de", "0xc5dE27336E04e4A6EB1A766323d3AD1d21efA767", "0xfE6776498f7b814A6b7b69fc37cDf8A993B01708", "0xC69aDFF7F2f28d5339fCe333259B1d804ffA44B3", "0x648349e02C549986C8ef2b75514d73040D581Acc", "0x6f36736A0D146e8B2DE5d580fe181Aa2f9f46D2a", "0x8aC228d85989cea83b8C07b8829524214C92Fee8", "0x5D80a1c0a5084163F1D2620c1B1F43209cd4dB12", "0x6C21A841d6f029243AF87EF01f6772F05832144b", "0x8c1A4C98C470900567FB9e764243c89cDa79400C", "0x254D63d3eDfDf71a50D8Fa51B7D5083b46381E5a", "0xB8e6F532f6FeE638d369228E87af10A79ecaaf63", "0xbCc8cB0a825c61355a460da85159f1B43D5d49AB", "0xF20EeBD5E7B0b812CF2A892772439C1B945287fE"].includes(this.account);
    },

    watchCloseModal() {
      this.modalService.watchCloseModal().subscribe(() => {
        this.closeModal();
      })
    },

  },
  destroyed() {
    clearInterval(this.gasPriceIntervalId);
  }
};
</script>


<style lang="scss">
@import "~@/styles/themes/theme-dark";
@import "~@/styles/themes/theme-light";

html {
  color: var(--default-text-color);

  ::placeholder {
    color: var(--default-input-placeholder-color);
    opacity: 1;
  }

  :-ms-input-placeholder {
    color: var(--default-input-placeholder-color);
  }

  ::-ms-input-placeholder {
    color: var(--default-input-placeholder-color);
  }
}
</style>
<style lang="scss" scoped>
@import "~@/styles/variables";

a {
  color: black;
}

.page-content:before {
  content: ' ';
  display: block;
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: var(--app-page-content__background--opacity);
  z-index: -1;
  background-image: var(--app-page-content__background);
}

.content {
  position: relative;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0 68px 0;

  .account-apr-widget-wrapper {
    position: absolute;
    top: 0;
    left: calc(50% - 111px);
  }
}

.logo {
  cursor: pointer;
  margin-left: 5vw;

  @media screen and (min-width: $md) {
    margin-left: 40px;
  }

  &:hover {
    transform: scale(1.02);
  }
}

.connect, .wallet {
  margin-right: 5vw;

  @media screen and (min-width: $md) {
    margin-right: 40px;
  }
}

.connect {
  white-space: nowrap;
  color: #6b70ed;
  cursor: pointer;

  &:hover {
    font-weight: 500;
  }
}

.banner-link {
  text-decoration: underline;
  cursor: pointer;
}

.banner-unwinded-glp {
  height: 70px;
  text-align: center;
  padding: 0 70px;
}

.top-bar__left-part {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.top-bar__theme-toggle {
  margin-left: 24px;
}

</style>

