import { mapState } from 'vuex';
import Vue from "vue";
import config from "@/config";
import { Contract } from "ethers";
import EXCHANGETUP from '@contracts/PangolinExchangeTUP.json'
import EXCHANGE from '@contracts/PangolinExchange.json'
import {parseUnits, formatUnits} from "../utils/calculate";
import {parseArweaveURI} from "../utils/blockchain";

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
    async handleTransaction(fun, args, onSuccess, onFail) {
      try {
        const tx = Array.isArray(args) ? await fun(...args) : await fun(args);
        if (tx) {
          await provider.waitForTransaction(tx.hash);
        }

        Vue.$toast.success('Transaction success');
        if (onSuccess) onSuccess();
      } catch (error) {
        let message;
        if (this.isAvalancheChain) {
          message = JSON.parse(error.error.error.body).error.message;
          message = message.split(message.indexOf(':') + 1);
        } else {
          message = error.data ? error.data.message : (error.message ? error.message : error);
        }

        if (message.startsWith("[ethjs-query]")) {
          if (message.includes("reason string")) {
            message = message.split("reason string ")[1].split("\",\"data\":")[0];
          } else {
            message = message.split("\"message\":\"")[1].replace(".\"}}}\'", "")
          }
        }

        message = message.replace("Error: VM Exception while processing transaction: reverted with reason string ", "");
        message = message.replace(/'/g, '')

        Vue.$toast.error(message);
        if (onFail) onFail();
      }
    },
    async calculateSlippageForBuy(symbol, price, tokenDecimals, tokenAddress, amount) {
      if (amount > 0) {
        const exchange = new Contract(EXCHANGETUP.networks[this.chainId].address, EXCHANGE.abi, provider.getSigner());

        const expectedAvax = amount * this.usdToAVAX(price);

        let checkedAvax =
          await exchange.getEstimatedAVAXForERC20Token(
            parseUnits((amount).toString(), tokenDecimals), tokenAddress
          );

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
        const exchange = new Contract(EXCHANGE.networks[this.chainId].address, EXCHANGE.abi, provider.getSigner());

        const expectedAvax = amount * this.usdToAVAX(price);

        let checkedAvax =
          await exchange.getEstimatedAVAXFromERC20Token(
            parseUnits((amount).toString(), tokenDecimals), tokenAddress
          );

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
    parseArweaveAddress(uri) {
      return parseArweaveURI(uri);
    }
  },
  computed: {
    ...mapState('prices', ['avaxPrice']),
    ...mapState('network', ['chainId', 'provider']),
    isMobile() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    maxLTV() {
      return config.MAX_LTV;
    },
    isAvalancheChain() {
      return [43113, 43114].includes(config.chainId);
    }
  },
  data() {
    return {
      ltvValidators: [
        {
          require: function(value) { return value < config.MAX_LTV },
          message: `LTV should be lower than ${config.MAX_LTV * 100}%`
        }
      ],
      nonNegativeValidator: {
        require: function(value) { return value >= 0 },
        message: `Value cannot be smaller than 0`
      }
    }
  }
};
