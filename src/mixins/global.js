import {mapState} from 'vuex';
import config from "@/config";
import {Contract} from "ethers";
import EXCHANGETUP from '@contracts/PangolinIntermediaryTUP.json';
import EXCHANGE from '@artifacts/contracts/PangolinIntermediary.sol/PangolinIntermediary.json'
import {acceptableSlippage, formatUnits, parseUnits} from "../utils/calculate";
import {handleCall, handleTransaction} from "../utils/blockchain";
import Vue from 'vue';
import Modal from '../components/Modal';

export default {
  methods: {
    avaxToUSD(avax) {
      if (this.avaxPrice) {
        return avax * this.avaxPrice;
      }
    },

    usdToAVAX(price) {
      if (this.avaxPrice) {
        return price / this.avaxPrice;
      }
    },

    toHex(dec) {
      return '0x' + dec.toString(16);
    },

    toDec(hex) {
      return parseInt(hex, 16);
    },

    formatTokenBalance(value) {
      const balanceOrderOfMagnitudeExponent = String(value).split('.')[0].length - 1;
      const precisionMultiplierExponent = 5 - balanceOrderOfMagnitudeExponent;
      const precisionMultiplier = Math.pow(10, precisionMultiplierExponent >= 0 ? precisionMultiplierExponent : 0);
      return value !== null ? String(Math.round(value * precisionMultiplier) / precisionMultiplier) : '';
    },

    async handleTransaction(fun, args, onSuccess, onFail) {
      await handleTransaction(fun, args, onSuccess, onFail);
    },
    async handleCall(fun, args, onSuccess, onFail) {
      return await handleCall(fun, args, onSuccess, onFail);
    },
    async calculateSlippageForBuy(symbol, price, tokenDecimals, tokenAddress, amount) {
      if (amount > 0) {
        const exchange = new Contract(EXCHANGETUP.address, EXCHANGE.abi, provider.getSigner());

        const expectedAvax = amount * this.usdToAVAX(price);

        let checkedAvax =
          await exchange.getEstimatedAVAXForERC20Token(parseUnits((amount).toString(), tokenDecimals), tokenAddress);

        checkedAvax = parseFloat(formatUnits(checkedAvax, 18));

        let slippage = 0;

        if (checkedAvax > expectedAvax) {
          slippage = (checkedAvax - expectedAvax) / expectedAvax;
        }

        return slippage;
      } else {
        return 0;
      }
    },
    async calculateSlippageForSell(symbol, price, tokenDecimals, tokenAddress, amount) {
      if (amount > 0) {
        const exchange = new Contract(EXCHANGETUP.address, EXCHANGE.abi, provider.getSigner());

        const expectedAvax = amount * this.usdToAVAX(price);

        let checkedAvax =
          await this.handleCall(exchange.getEstimatedAVAXFromERC20Token, [parseUnits((amount).toString(), tokenDecimals), tokenAddress]);

        checkedAvax = parseFloat(formatUnits(checkedAvax, 18));

        let slippage = 0;

        if (checkedAvax < expectedAvax) {
          slippage = (expectedAvax - checkedAvax) / expectedAvax;
        }

        return slippage;
      } else {
        return 0;
      }
    },
    acceptableSlippage(slippage) {
      return acceptableSlippage(slippage);
    },
    logoSrc(asset) {
      asset = asset ? asset : 'avax';
      const assetData = config.ASSETS_CONFIG[asset.toUpperCase()];
      if (assetData) {
        return `src/assets/logo/${asset.toLowerCase()}.${assetData.logoExt ? assetData.logoExt : 'svg'}`;
      }
    },

    openModal(component) {
      const modal = Vue.extend(component);
      const instance = new modal();
      instance.$mount();
      document.body.appendChild(instance.$el);
      return instance;
    },

    closeModal() {
      const modalComponent = document.getElementById('modal');
      document.body.removeChild(modalComponent);
    },

    getAssetIcon(assetSymbol) {
      const asset = config.ASSETS_CONFIG[assetSymbol.toUpperCase()];
      return `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`;
    },
  },
  computed: {
    ...mapState('network', ['provider', 'avaxPrice']),
    isMobile() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    maxAllowedLTV() {
      return config.MAX_ALLOWED_LTV;
    },
    liquidationLTV() {
      return config.LIQUIDATION_LTV;
    }
  },
  data() {
    return {
      ltvValidators: [
        {
          validate: function (value) {
            if (value > config.MAX_ALLOWED_LTV) {
              return `LTV should be lower than ${config.MAX_ALLOWED_LTV * 100}%`;
            }
          }
        }
      ],
      positiveValidator: {
        validate: function (value) {
          if (value <= 0) {
            return `Value must be higher than 0`;
          }
        }
      },
      wrongFormatValidator: {
        validate: function (value) {
          console.log(value)
          if (!value.toString().match(/^[0-9.,]+$/)) {
            return `Incorrect formatting. Please use only alphanumeric values.`;
          }
        }
      }
    };
  }
};
