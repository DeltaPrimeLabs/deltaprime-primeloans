import { mapState } from 'vuex';
import Vue from "vue";
import config from "@/config";
import { Contract } from "ethers";
import EXCHANGETUP from '@contracts/PangolinExchangeTUP.json'
import EXCHANGE from '@contracts/PangolinExchange.json'
import {parseUnits, formatUnits} from "../utils/calculate";

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
    async handleTransaction(fun, args) {
      if (this.isAvalancheChain) {
        try {
          const tx = await Array.isArray(args) ? fun(...args) : fun(args);
          await provider.waitForTransaction(tx.hash);
          Vue.$toast.success('Transaction success');
        } catch (err) {
          const fullMessage = JSON.parse(err.error.error.body).error.message;
          const error = fullMessage.split(fullMessage.indexOf(':') + 1);
          Vue.$toast.error(error);
        }
      } else {
        try {
          Array.isArray(args) ? await fun(...args) : await fun(args);
          Vue.$toast.success('Transaction success');
        } catch(error) {
          let message = error.data.message ? error.data.message : error;
          message = message.replace("Error: VM Exception while processing transaction: reverted with reason string ", "");
          message = message.substring(1, message.length - 1);
          Vue.$toast.error(message);
        }
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
          message: `LTC should be lower than ${config.MAX_LTV * 100}%`
        }
      ],
      nonNegativeValidator: {
        require: function(value) { return value >= 0 },
        message: `Value cannot be smaller than 0`
      }
    }
  }
};
