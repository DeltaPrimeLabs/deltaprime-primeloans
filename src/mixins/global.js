import {mapState} from 'vuex';
import config from "@/config";
import {Contract} from "ethers";
import EXCHANGETUP from '@contracts/PangolinExchangeTUP.json';
import EXCHANGE from '@artifacts/contracts/PangolinExchange.sol/PangolinExchange.json'
import {acceptableSlippage, formatUnits, parseUnits} from "../utils/calculate";
import {handleCall, handleTransaction} from "../utils/blockchain";

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
      await handleTransaction(fun, args, onSuccess, onFail)
    },
    async handleCall(fun, args, onSuccess, onFail) {
      return await handleCall(fun, args, onSuccess, onFail)
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
      return `src/assets/logo/${asset.toLowerCase()}.${assetData.logoExt ? assetData.logoExt : 'svg'}`;
    }
  },
  computed: {
    ...mapState('network', ['provider', 'avaxPrice']),
    isMobile() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    maxLTV() {
      return config.MAX_LTV;
    },
  },
  data() {
    return {
      ltvValidators: [
        {
          validate: function (value) {
            if (value > config.MAX_LTV) {
              return`LTV should be lower than ${config.MAX_LTV * 100}%`
            }
          }
        }
      ],
      nonNegativeValidator: {
        validate: function(value) {
          if (value < 0) {
            return `Value cannot be smaller than 0`;
          }
        }
      },
      wrongFormatValidator: {
        validate: function(value) {
          if (!value.toString().match(/^[0-9.,]+$/)) {
            return `Incorrect formatting. Please use only alphanumeric values.`;
          }
        }
      }
    }
  }
};
