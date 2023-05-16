<template>
  <div id="modal" class="deposit-modal-component modal-component">
    <Modal height="561px">
      <div class="modal__title">
        Bridge and deposit
      </div>
      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value">{{ sourceAssetBalance | smartRound }}<span class="top-info__currency"> {{ symbol }}</span></div>
      </div>

      <div class="chains">
        <div v-for="chain of sourceChains" v-bind:key="chain.id" class="chain" v-on:click="updateChain(chain)">
          <img :src="chain.logoURI" class="chain-logo">
        </div>
      </div>

      <CurrencyComboInput ref="sourceInput"
        :asset-options="availableTokens"
        :default-asset="availableTokens[0]"
        :validators="[]"
        :disabled="false"
        v-on:valueChange="sourceInputChange"
        :typingTimeout="2000"
      >
      </CurrencyComboInput>

      <div class="slippage-bar">
        <div class="slippage-info">
          <span class="slippage-label">Max. acceptable slippage:</span>
          <SimpleInput :percent="true" :default-value="userSlippage" v-on:newValue="userSlippageChange"></SimpleInput>
          <span class="percent">%</span>
        </div>
      </div>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            <div class="pool">
              <img class="pool__icon" :src="`src/assets/logo/${poolAsset.symbol.toLowerCase()}.svg`">
              <div class="pool__name">{{ poolAsset.symbol }} Pool</div>
              ,
            </div>
            Values after confirmation:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div>
              <div class="summary__label">
                Min. deposited amount:
              </div>
              <div class="summary__value">
                {{ minDepositValue }} <span class="currency">{{ poolAsset.symbol }}</span>
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Bridge'" v-on:click="submit()" :disabled="wait" ></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import CurrencyInput from './CurrencyInput';
import Button from './Button';
import Toggle from './Toggle';
import CurrencyComboInput from './CurrencyComboInput';
import SimpleInput from './SimpleInput';
import erc20ABI from '../../test/abis/ERC20.json';
import config from "../config";
import {formatUnits, parseUnits} from "ethers/lib/utils";
import LIFI from "@lifi/sdk";
const ethers = require('ethers');
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import POOL from '../../artifacts/contracts/Pool.sol/Pool.json';
import web3Abi from "web3-eth-abi";
const MAX_UINT256 = ethers.constants.MaxUint256;

const ethereum = window.ethereum;

export default {
  name: 'BridgeDepositModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    Toggle,
    CurrencyComboInput,
    SimpleInput
  },

  props: {
    account: null,
    signer: null,
    deposit: 0,
    lifi: null,
    poolAsset: null,
    poolAssetPrice: 0,
    poolAddress: null,
  },

  data() {
    return {
      bridgedValue: 0,
      validators: [],
      sourceChain: null,
      sourceChains: [],
      sourceAssetBalance: 0,
      allTokens: [],
      availableTokens: [],
      userSlippage: 3,
      wait: true,
      minDepositValue: 0
    };
  },

  mounted() {
    this.setupValidators();
    this.initLifi();
  },

  computed: {
    symbol() {
      return this.assetSymbol === 'AVAX' ? this.selectedDepositAsset : this.assetSymbol;
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      console.log('submit')
      console.log(this.routes[0])
      const bridgeEvent = {
        route: this.routes[0],
        lifi: this.lifi
      };
      this.$emit('BRIDGE', bridgeEvent);
    },

    bridgedValueChange(event) {
      this.bridgedValue = event.value;
    },

    async updateChain(chain) {
      this.sourceChain = chain;
      this.availableTokens = this.allTokens[chain.id];

      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{chainId: this.toHex(chain.id)}],
      });
    },

    async initLifi() {
      this.lifi = new LIFI();

      Promise.all([
        fetch('https://li.quest/v1/chains'),
        fetch('https://li.quest/v1/tokens')
      ]).then(
        async (responses) => {
          Promise.all([
            responses[0].json(),
            responses[1].json()
          ]).then(results => {
            this.sourceChains = results[0].chains;
            this.allTokens = results[1].tokens;
            console.log(this.sourceChains)
            console.log(this.sourceTokens)
          })
        }
      )
    },

    sourceInputChange(changeEvent) {
      this.maxButtonUsed = changeEvent.maxButtonUsed;
      this.checkingRoute = true;
      let targetInputChangeEvent;

      if (this.sourceAsset !== changeEvent.asset) {

        this.sourceAsset = changeEvent.asset;

        this.sourceAssetData = this.availableTokens.find(token => token.symbol === changeEvent.asset);

        this.calculateSourceAssetBalance();

      } else {
        let value = Number.isNaN(changeEvent.value) ? 0 : changeEvent.value;
        this.sourceAssetAmount = value;

        this.updateAmounts();
        this.getRoute();
      }

      this.sourceInputError = changeEvent.error;
      if (targetInputChangeEvent) {
        this.targetInputError = targetInputChangeEvent.error;
      }

      this.checkingRoute = false;
    },

    getSigner() {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      window.provider = provider;
      return provider.getSigner();
    },

    calculateSourceAssetBalance() {
      const tokenContract = new ethers.Contract(this.sourceAssetData.address, erc20ABI, this.getSigner());

      tokenContract.balanceOf(this.account).then(
          balance => this.sourceAssetBalance = formatUnits(balance, this.sourceAssetData.decimals)
      );
    },

    getRoute() {
      console.log('getRoute')
      const routeOptions = {
        slippage: this.userSlippage / 100, // 3%
        order: 'RECOMMENDED'
      }

      //TODO: that should be "deposit onbehalf")
      let calldata = web3Abi.encodeFunctionCall(
          POOL.abi.find(method => method.name === 'deposit'),
          [MAX_UINT256]
      );

      console.log('calldata');
      console.log(calldata);
      console.log('poolAddress');
      console.log(this.poolAddress);

      console.log('fromAmount');
      console.log((this.sourceAssetAmount * 10**this.sourceAssetData.decimals).toFixed());

      const quoteRequest = {
        fromChain: this.sourceChain.id,
        fromAddress: this.account,
        fromToken: this.sourceAssetData.address,
        toChain: config.chainId,
        toToken: TOKEN_ADDRESSES[this.poolAsset.symbol],
        toContractAddress: this.poolAddress,
        toContractCallData: calldata,
        toContractGasLimit: '2000000',
        toAmount: this.minDepositValue
    }

      // const routesRequest = {
      //   fromChainId: this.sourceChain.id,
      //   fromAmount: (this.sourceAssetAmount * 10**this.sourceAssetData.decimals).toFixed(),
      //   fromTokenAddress: this.sourceAssetData.address,
      //   toChainId: config.chainId,
      //   toTokenAddress: TOKEN_ADDRESSES[this.poolAsset.symbol],
      //   options: routeOptions,
      // }

      console.log('quoteRequest')
      console.log(quoteRequest)

      this.wait = true;

      // const routesRequest = this.lifi.getRoutes(routesRequest).then(
      //     response => {
      //       console.log('response')
      //       console.log(response)
      //       this.routes = response.routes;
      //       this.wait = false;
      //     }
      // )

      return this.lifi.getContractCallQuote(quoteRequest)
    },

    async userSlippageChange(changeEvent) {
      this.userSlippage = changeEvent.value ? changeEvent.value : 0;

      await this.updateAmounts();
    },

    async updateAmounts() {
      this.receivedAccordingToOracle = this.sourceAssetAmount * parseFloat(this.sourceAssetData.priceUSD) / this.poolAssetPrice;

      this.minDepositValue = this.receivedAccordingToOracle * (1 - this.userSlippage / 100);
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.available) {
              return 'Exceeds account balance'
            }
          }
        }
      ]
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";
@import "~@/styles/slippage";

.chains {
  display: flex;
  margin-bottom: 10px;

  .chain {
    margin-left: 5px;
    .chain-logo {
      border-radius: 15px;
      width: 30px;
      cursor: pointer;
    }
  }
}

</style>