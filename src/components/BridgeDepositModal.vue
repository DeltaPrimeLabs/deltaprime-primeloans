<template>
  <div id="modal" class="bridge-deposit-modal-component modal-component">
    <Modal height="561px">
      <div class="modal__title">
        {{ title }}
      </div>

      <div class="asset-info" v-if="sourceAssetBalance">
        Available:
        <span v-if="sourceAssetBalance" class="asset-info__value">{{
            Number(sourceAssetBalance) | smartRound(10, true)
          }}</span>
      </div>

      <CurrencyComboInput
        ref="sourceInput"
        :isBridge="true"
        :available-chains="availableChains"
        :asset-options="availableAssets"
        :assets-balances="sourceAssetsBalances"
        :validators="sourceValidators"
        :disabled="!sourceAsset"
        :max="sourceAssetBalance"
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
                {{ formatTokenBalance(Number(targetBalance) + Number(!disableDeposit ? targetAssetAmount : 0)) }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <Alert
        v-if="!requestingRoute && routes && routes.length == 0"
        class="alert-wrapper"
      >
        No routes available
      </Alert>

      <Alert
        v-if="!requestingRoute && routeValidationError"
        class="alert-wrapper"
      >
        {{ routeValidationError }}
      </Alert>

      <div
        v-if="chosenRoute"
        class="bridge-info"
      >
        Estimated Duration: {{ estimatedDuration }}
      </div>

      <div class="button-wrapper">
        <Button
          :label="'Bridge'"
          v-on:click="submit()"
          :disabled="sourceInputError || !chosenRoute || (routes && routes.length == 0)"
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
import Alert from './Alert.vue';
import config from "../config";
import { formatUnits } from '../utils/calculate';
import { BigNumber } from 'ethers';
import moment from 'moment';
import momentDurationFormatSetup from "moment-duration-format";

momentDurationFormatSetup(moment);

export default {
  name: 'BridgeDepositModal',

  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    Toggle,
    CurrencyComboInput,
    SimpleInput,
    Alert
  },

  props: {
    lifiData: null,
    account: null,
    targetAsset: null,
    targetAssetAddress: null,
    targetBalance: null,
    disableDeposit: null
  },

  data() {
    return {
      title: null,
      lifi: null,
      availableChains: null,
      availableAssets: null,
      bridgedValue: 0,
      sourceChain: null,
      sourceAsset: null,
      sourceAssetAmount: null,
      sourceAssetBalance: null,
      sourceAssetsBalances: {},
      sourceValidators: [],
      sourceInputError: true,
      targetAssetOptions: null,
      targetAssetAmount: null,
      userSlippage: 0.5,
      wait: true,
      minDepositValue: 0,
      isTyping: false,
      transactionOngoing: false,
      chosenRoute: null,
      routes: null,
      requestingRoute: false,
      routeValidationError: null
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupLifi();
      this.setupTargetAssetOptions();
      this.title = this.disableDeposit ? "Bridge" : "Bridge deposit";
    });
  },

  watch: {
    sourceAssetsBalances: {
      handler(newBalances) {
        if (!this.sourceAsset) return;

        const assetData = newBalances[this.sourceChain].find(asset => asset.symbol === this.sourceAsset);
        if (assetData) {
          this.sourceAssetBalance = assetData.amount
          this.setSourceValidators();
        }
      },
      deep: true
    },

    sourceAsset: {
      handler(newAsset) {
        if (!this.sourceAssetsBalances[this.sourceChain]) return;

        const assetData = this.sourceAssetsBalances[this.sourceChain].find(asset => asset.symbol === newAsset);
        if (assetData) {
          this.sourceAssetBalance = assetData.amount;
          this.setSourceValidators();
        }
      }
    }
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
    },

    estimatedDuration() {
      const formatString = 'D [days], H [hours], m [minutes], s [seconds]';
      const estimatedDuration = this.lifiService.getEstimatedDuration(this.chosenRoute);

      return moment.duration(estimatedDuration, 'seconds').format(formatString);
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

    async getBestRoute(sourceAssetData) {
      if (this.sourceAssetAmount == null) return;
      if (this.sourceAssetAmount == 0) {
        this.targetAssetAmount = 0;
        return;
      }

      this.requestingRoute = true;

      const routesRequest = {
        fromChainId: this.sourceChain,
        fromAmount: this.sourceAssetAmount,
        fromTokenAddress: sourceAssetData.address.toLowerCase(),
        fromAddress: this.account.toLowerCase(),
        toChainId: config.chainId,
        toTokenAddress: this.targetAssetAddress.toLowerCase(),
        toAddress: this.account.toLowerCase(),
        options: {
          order: 'RECOMMENDED',
          slippage: this.userSlippage / 100,
          allowSwitchChain: true
        }
      };

      const routes = await this.lifiService.getBestRoute(this.lifi, routesRequest, sourceAssetData.decimals);

      if (routes.error) {
        this.routeValidationError = routes.message;
        this.requestingRoute = false;
        return;
      }

      this.routes = routes;
      // To-Do: allows to choose desired route option
      if (routes.length > 0) {
        this.chosenRoute = routes[0];
      }

      if (this.chosenRoute) {
        this.targetAssetAmount = formatUnits(BigNumber.from(this.chosenRoute.toAmountMin), this.chosenRoute.toToken.decimals);
        this.$refs.targetInput.setCurrencyInputValue(this.targetAssetAmount);
      }

      this.requestingRoute = false;
    },

    submit() {
      this.transactionOngoing = true;
      const bridgeEvent = {
        chosenRoute: this.chosenRoute,
        depositNativeToken: this.targetAsset === 'AVAX'
      };
      
      this.$emit('BRIDGE_DEPOSIT', bridgeEvent);
    },

    bridgedValueChange(event) {
      this.bridgedValue = event.value;
    },

    async sourceChainChange(changeEvent) {
      if (this.sourceChain !== changeEvent.chainId) {
        this.sourceChain = changeEvent.chainId;

        const balances = await this.lifiService.fetchTokenBalancesForChain(
          this.lifi,
          this.account,
          changeEvent.chainId,
          changeEvent.tokens
        );

        this.sourceAssetsBalances = {
          ...this.sourceAssetsBalances,
          [changeEvent.chainId]: balances
        };
      }
    },

    async sourceInputChange(changeEvent) {
      const sourceAssetData = this.availableAssets[changeEvent.chain.id].find(asset => asset.symbol === changeEvent.asset);
      if (this.sourceAsset !== changeEvent.asset) {        
        this.sourceAsset = changeEvent.asset;

        if (this.sourceChain === config.chainId &&
            sourceAssetData.address.toLowerCase() === this.targetAssetAddress.toLowerCase()) {
          this.routeValidationError = 'The same token cannot be used as both the source and destination token.';
          return;
        } else if (this.routeValidationError) {
          this.routeValidationError = null;
        }

        await this.getBestRoute(sourceAssetData);
      } else {
        let value = Number.isNaN(changeEvent.value) ? 0 : changeEvent.value;
        this.sourceAssetAmount = value;

        if (value != 0) {
          await this.getBestRoute(sourceAssetData);
        } else {
          this.targetAssetAmount = 0;
        }
      }
      this.sourceInputError = changeEvent.error;
    },

    setSourceValidators() {
      this.sourceValidators = [
        {
          validate: async (value) => {
            if (value > parseFloat(this.sourceAssetBalance)) {
              return 'Amount exceeds available funds.';
            }
          }
        },
      ];
    },

    async userSlippageChange(changeEvent) {
      this.userSlippage = changeEvent.value ? changeEvent.value : 0;
      await this.updateAmounts();
    },

    ongoingTyping(event) {
      this.isTyping = event.typing;
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.asset-info {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  font-size: $font-size-xsm;
  color: var(--swap-modal__asset-info-color);
  padding-right: 8px;

  .asset-info__value {
    font-weight: 600;
    margin-left: 5px;
  }
}

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

.alert-wrapper {
  margin-top: 30px;
}

.bridge-info {
  margin-top: 30px;
  display: flex;
  justify-content: center;
}

</style>