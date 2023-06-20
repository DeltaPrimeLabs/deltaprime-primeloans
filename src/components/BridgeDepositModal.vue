<template>
  <div id="modal" class="deposit-modal-component modal-component">
    <Modal height="561px">
      <div class="modal__title">
        Bridge deposit
      </div>

      <CurrencyComboInput
        ref="sourceInput"
        :isBridge="true"
        :available-chains="availableChains"
        :asset-options="availableAssets"
        :assets-balances="sourceAssetsBalances"
        :validators="sourceValidators"
        :disabled="!sourceAsset"
        :info="() => sourceAssetValue"
        :typingTimeout="2000"
        v-on:chainChange="sourceChainChange"
        v-on:valueChange="sourceInputChange"
        v-on:ongoingTyping="ongoingTyping"
      ></CurrencyComboInput>

      <CurrencyComboInput
        class="target-input"
        ref="targetInput"
        :disabled="true"
        :asset-options="targetAssetOptions"
        :default-asset="targetAsset"
        :info="() => targetAssetValue"
        info-icon-message="Minimum received amount"
        v-on:ongoingTyping="ongoingTyping"
      ></CurrencyComboInput>

      <div class="target-asset-info">
        <div class="usd-info">
          Price:&nbsp;<span
            class="price-info__value">1 {{
            targetAsset
          }} = {{ sourceAmountPerTarget | smartRound }} {{ sourceAsset }}</span>
        </div>
      </div>

      <div class="slippage-bar">
        <div class="slippage-info">
          <span class="slippage-label">Max. acceptable slippage:</span>
          <SimpleInput :percent="true" :default-value="userSlippage" v-on:newValue="userSlippageChange"></SimpleInput>
          <span class="percent">%</span>
        </div>
      </div>

      <div v-if="targetAsset" class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            <div class="pool">
              <img class="pool__icon" :src="`src/assets/logo/${targetAsset.toLowerCase()}.svg`">
              <div class="pool__name">{{ targetAsset }}</div>
              ,
            </div>
            Values after confirmation:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div>
              <div class="summary__label">
                <span class="currency">{{ targetAsset }}</span> deposit:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(Number(targetBalance) + Number(targetAssetAmount)) }} 
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button
          :label="'Bridge'"
          v-on:click="submit()"
          :disabled="sourceInputError || !chosenRoute"
          :waiting="transactionOngoing || isTyping || requestingRoute">
        ></Button>
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
import config from "../config";
import { formatUnits } from '../utils/calculate';
import { BigNumber } from 'ethers';

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
    lifiData: null,
    lifiService: null,
    account: null,
    targetAsset: null,
    targetAssetAddress: null,
    targetAssetPrice: 0,
    targetBalance: null,
    poolAddress: null,
  },

  data() {
    return {
      lifi: null,
      availableChains: null,
      availableAssets: null,
      bridgedValue: 0,
      sourceChain: null,
      sourceAsset: null,
      sourceAssetAmount: null,
      sourceAssetBalance: null,
      sourceAssetsBalances: null,
      sourceValidators: [],
      sourceInputError: true,
      targetAssetOptions: null,
      targetAssetAmount: null,
      userSlippage: 3,
      wait: true,
      minDepositValue: 0,
      isTyping: false,
      transactionOngoing: false,
      chosenRoute: null,
      requestingRoute: false
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupLifi();
      this.setupTargetAssetOptions();
      this.setupValidators();
    });
  },

  computed: {
    sourceAssetValue() {
      if (!this.chosenRoute) return;
      return `~ $${this.chosenRoute.fromAmountUSD}`;
    },

    targetAssetValue() {
      if (!this.chosenRoute) return;
      return `~ $${this.chosenRoute.toAmountUSD}`;
    },

    sourceAmountPerTarget() {
      if (!this.sourceAssetAmount || !this.targetAssetAmount) return ;
      return Number(this.sourceAssetAmount) / Number(this.targetAssetAmount);
    }
  },

  methods: {
    setupLifi() {
      if (this.lifiData) {
        this.lifi = this.lifiData.lifi;
        this.availableChains = this.lifiData.chains;
        this.availableAssets = this.lifiData.tokens;
      }
    },

    setupTargetAssetOptions() {
      const asset = config.ASSETS_CONFIG[this.targetAsset];
      this.targetAssetOptions = [{
        symbol: this.targetAsset,
        name: asset.name,
        logo: `src/assets/logo/${this.targetAsset.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
      }];
    },

    async getBestRoute() {
      if (this.sourceAssetAmount == null) return;
      if (this.sourceAssetAmount == 0) {
        this.targetAssetAmount = 0;
        return;
      }

      this.requestingRoute = true;

      const routesRequest = {
        fromChainId: this.sourceChain,
        fromAmount: this.sourceAssetAmount,
        fromTokenAddress: this.sourceAssetData.address.toLowerCase(),
        fromAddress: this.account.toLowerCase(),
        toChainId: config.chainId,
        toTokenAddress: this.targetAssetAddress.toLowerCase(),
        toAddress: this.poolAddress.toLowerCase(),
        options: {
          order: 'RECOMMENDED',
          slippage: this.userSlippage / 100,
          allowSwitchChain: true
        }
      };

      this.chosenRoute = await this.lifiService.getBestRoute(this.lifi, routesRequest);
      console.log(this.chosenRoute);
      this.targetAssetAmount = formatUnits(BigNumber.from(this.chosenRoute.toAmountMin), this.chosenRoute.toToken.decimals);
      this.$refs.targetInput.setCurrencyInputValue(this.targetAssetAmount);
      this.requestingRoute = false;
    },

    submit() {
      this.transactionOngoing = true;
      const bridgeEvent = {
        chosenRoute: this.chosenRoute
      };
      
      this.$emit('BRIDGE_DEPOSIT', bridgeEvent);
    },

    bridgedValueChange(event) {
      this.bridgedValue = event.value;
    },

    async sourceChainChange(changeEvent) {
      if (this.sourceChain !== changeEvent.chainId) {
        this.balancesReceived = false;
        this.sourceChain = changeEvent.chainId;

        const balances = await this.lifiService.fetchTokenBalancesForChain(
          this.lifiData.lifi,
          this.account,
          changeEvent.chainId,
          changeEvent.tokens
        );
        this.sourceAssetsBalances = balances;

        // this.$emit("chainChange", {
        //   chainId: changeEvent.chainId,
        //   tokens: changeEvent.tokens
        // });
      }
    },

    async sourceInputChange(changeEvent) {
    //   this.maxButtonUsed = changeEvent.maxButtonUsed;
    //   this.checkingRoute = true;
    //   let targetInputChangeEvent;
      if (this.sourceAsset !== changeEvent.asset) {        
        this.sourceAsset = changeEvent.asset;
        this.sourceAssetData = this.availableAssets[changeEvent.chain.id].find(token => token.symbol === changeEvent.asset);

        await this.getBestRoute();
        // this.calculateSourceAssetBalance();
      } else {
        let value = Number.isNaN(changeEvent.value) ? 0 : changeEvent.value;
        this.sourceAssetAmount = value;

        if (value != 0) {
          await this.getBestRoute();
        } else {
          this.targetAssetAmount = 0;
        }
        // this.updateAmounts();
        // this.getRoute();
      }
      this.sourceInputError = changeEvent.error;
    //   if (targetInputChangeEvent) {
    //     this.targetInputError = targetInputChangeEvent.error;
    //   }
    //   this.checkingRoute = false;
    },

    setupValidators() {
      this.sourceValidators = [
        {
          validate: async (value) => {
            if (value > parseFloat(this.sourceAssetBalance)) {
              return 'Amount exceeds the current deposit.';
            }
          }
        },
      ];
    },

    // getProvider() {
    //   const jsonRPC = "https://avalanche-mainnet.infura.io/v3/44a75435541f40cdac3945feaf38ba26"
    //   const provider = new ethers.providers.JsonRpcProvider(jsonRPC);
    //   return provider;
    // },

    // async calculateSourceAssetBalance() {
    //   console.log(this.signer);
    //   const contract = new ethers.Contract(this.sourceAssetData.address, erc20ABI, this.signer);
    //   console.log(contract);
    //   const balance = await contract.balanceOf(this.account);
    //   console.log(balance);
    // },

    // getRoute() {
    //   console.log('getRoute')
    //   const routeOptions = {
    //     slippage: this.userSlippage / 100, // 3%
    //     order: 'RECOMMENDED'
    //   }
    //   //TODO: that should be "deposit onbehalf")
    //   let calldata = web3Abi.encodeFunctionCall(
    //       POOL.abi.find(method => method.name === 'deposit'),
    //       [MAX_UINT256]
    //   );
    //   console.log('calldata');
    //   console.log(calldata);
    //   console.log('poolAddress');
    //   console.log(this.poolAddress);
    //   console.log('fromAmount');
    //   console.log((this.sourceAssetAmount * 10**this.sourceAssetData.decimals).toFixed());
    //   const quoteRequest = {
    //     fromChain: this.sourceChain.id,
    //     fromAddress: this.account,
    //     fromToken: this.sourceAssetData.address,
    //     toChain: config.chainId,
    //     toToken: TOKEN_ADDRESSES[this.targetAsset.symbol],
    //     toContractAddress: this.poolAddress,
    //     toContractCallData: calldata,
    //     toContractGasLimit: '2000000',
    //     toAmount: this.minDepositValue
    //   };
    //   // const routesRequest = {
    //   //   fromChainId: this.sourceChain.id,
    //   //   fromAmount: (this.sourceAssetAmount * 10**this.sourceAssetData.decimals).toFixed(),
    //   //   fromTokenAddress: this.sourceAssetData.address,
    //   //   toChainId: config.chainId,
    //   //   toTokenAddress: TOKEN_ADDRESSES[this.targetAsset.symbol],
    //   //   options: routeOptions,
    //   // }
    //   // console.log('quoteRequest')
    //   // console.log(quoteRequest)
    //   // this.wait = true;
    //   // const routesRequest = this.lifi.getRoutes(routesRequest).then(
    //   //     response => {
    //   //       console.log('response')
    //   //       console.log(response)
    //   //       this.routes = response.routes;
    //   //       this.wait = false;
    //   //     }
    //   // )
    //   // return this.lifi.getContractCallQuote(quoteRequest)
    // },

    async userSlippageChange(changeEvent) {
      this.userSlippage = changeEvent.value ? changeEvent.value : 0;
      await this.updateAmounts();
    },

    // async updateAmounts() {
    //   this.receivedAccordingToOracle = this.sourceAssetAmount * parseFloat(this.sourceAssetData.priceUSD) / this.targetAssetPrice;
    //   this.minDepositValue = this.receivedAccordingToOracle * (1 - this.userSlippage / 100);
    // },

    ongoingTyping(event) {
      this.isTyping = event.typing;
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.target-input {
  margin-top: 56px;
}

.target-asset-info {
  display: flex;
  justify-content: flex-end;

  .usd-info {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    font-size: $font-size-xsm;
    color: var(--swap-modal__usd-info-color);
    margin-top: 3px;

    .asset-info__value {
      margin-left: 5px;
    }

    .price-info__value {
      font-weight: 600;
    }
  }
}

.slippage-bar {
  border-top: var(--swap-modal__slippage-bar-border);
  border-bottom: var(--swap-modal__slippage-bar-border);
  margin-top: 26px;
  height: 42px;
  font-family: Montserrat;
  font-size: 16px;
  color: var(--swap-modal__slippage-bar-color);
  display: flex;
  justify-content: center;
  align-items: center;
  padding-left: 15px;
  padding-right: 15px;

  .info__icon {
    transform: translateY(-1px);
  }

  .percent {
    font-weight: 600;
  }

  .slippage-info {
    display: flex;
    align-items: center;

    .percent {
      margin-left: 6px;
    }

    .slippage-label {
      margin-right: 6px;
    }
  }

  .deviation-value {
    font-weight: 600;
  }

  .slippage__divider {
    width: 2px;
    height: 17px;
    background-color: var(--swap-modal__slippage-divider-color);
    margin: 0 10px;
  }
}

</style>