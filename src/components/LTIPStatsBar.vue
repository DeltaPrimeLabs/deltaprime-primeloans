<template>
<div class="ltip-stats-bar-component">
  <div class="ltip__title">LTIP Incentives Program</div>
  <div class="stats-row">
    <div class="stat__entry">
      <div class="stat-label">
        Total eligible TVL
        <InfoIcon class="info__icon"
                  :tooltip="{content: 'Tooltip placeholder', classes: 'info-tooltip'}"
                  :classes="'info-tooltip'">
        </InfoIcon>
      </div>
      <div class="stat-value">{{ totalEligibleTVL | usd }}</div>
    </div>
    <div class="stat__entry">
      <div class="stat-label">
        Mission completion
        <InfoIcon class="info__icon"
                  :tooltip="{content: 'Tooltip placeholder', classes: 'info-tooltip'}"
                  :classes="'info-tooltip'">
        </InfoIcon>
      </div>
      <div class="stat-value">
        <bar-gauge-beta v-tooltip="{content: `Grant milestone completion: $${(totalEligibleTVL / 1000000).toFixed(1)}M / $${milestone / 1000000}M`, classes: 'info-tooltip'}"
                        :min="0" :max="milestone" :value="totalEligibleTVL" :width="108"></bar-gauge-beta>
      </div>
    </div>
    <div class="stat__entry">
      <div class="stat-label">
        Your eligible TVL
        <InfoIcon class="info__icon"
                  :tooltip="{content: 'Tooltip placeholder', classes: 'info-tooltip'}"
                  :classes="'info-tooltip'">
        </InfoIcon>
      </div>
      <div class="stat-value">{{ yourEligibleTVL | usd }}</div>
    </div>
    <div class="stat__entry">
      <div class="stat-label">
        1x APR Boost
        <InfoIcon class="info__icon"
                  :tooltip="{content: 'Tooltip placeholder', classes: 'info-tooltip'}"
                  :classes="'info-tooltip'">
        </InfoIcon>
      </div>
      <div class="stat-value">
        {{ aprBoost | percent }}
        <div class="shine-icon"></div>
      </div>
    </div>
    <div class="stat__entry">
      <div class="stat-label">
        Max APR boost
        <InfoIcon class="info__icon"
                  :tooltip="{content: 'Tooltip placeholder', classes: 'info-tooltip'}"
                  :classes="'info-tooltip'">
        </InfoIcon>
      </div>
      <div class="stat-value">
        {{ maxAprBoost | percent }}
        <div class="shine-icon"></div>
      </div>
    </div>
    <div class="stat__entry">
      <div class="stat-label">
        ARB collected
        <InfoIcon class="info__icon"
                  :tooltip="{content: 'Tooltip placeholder', classes: 'info-tooltip'}"
                  :classes="'info-tooltip'">
        </InfoIcon>
      </div>
      <div class="stat-value">
        {{ collectedBonus | smartRound(8, true) }}
        <img class="incentives-icon" src="src/assets/logo/arb.png">
      </div>
    </div>
  </div>
</div>
</template>

<script>


import BarGaugeBeta from './BarGaugeBeta.vue';
import InfoIcon from './InfoIcon.vue';
import LTIP_DISTRIBUTED_ARBITRUM from "../data/arbitrum/ltip/LTIP_EPOCH_0.json";
import {fromWei} from "../utils/calculate";
import {mapState} from "vuex";
import {wrapContract} from "../utils/blockchain";
import config from "../config";

export default {
  name: 'LTIPStatsBar',
  components: {InfoIcon, BarGaugeBeta},
  data() {
    return {
      wrappedContract: null,
      totalEligibleTVL: null,
      milestone: config.ltipMilestone,
      yourEligibleTVL: null,
      collectedBonus: null,
    }
  },
  mounted() {
    this.watchLtipDataUpdate();
  },
  computed: {
    ...mapState('fundsStore', [
      'smartLoanContract',
      'apys',
      'assets',
    ]),
    ...mapState('serviceRegistry', ['ltipService']),
    aprBoost() {
        return (this.apys && this.assets && this.assets['ARB'] && this.assets['ARB'].price) ? this.apys['LTIP_BOOST'].arbApy * this.assets['ARB'].price : 0;
    },
    maxAprBoost() {
      if (!this.aprBoost) return 0;
      return 4.5 * this.aprBoost;
    },
  },
  methods: {
    watchLtipDataUpdate() {
      this.ltipService.observeLtipAccountsData().subscribe((list) => {
        let ltipAccountData = list.find(el => el.id.toLowerCase() === this.smartLoanContract.address.toLowerCase());
        if (ltipAccountData) this.collectedBonus = ltipAccountData.arbCollected;
      });
      this.ltipService.observeLtipTotalEligibleTvlData().subscribe((tvl) => {
        this.totalEligibleTVL = tvl;
      });
      this.ltipService.observeLtipPrimeAccountEligibleTvl().subscribe((tvl) => {
        this.yourEligibleTVL = tvl;
      });
    }
  },
  watch: {
    smartLoanContract: {
      async handler(smartLoanContract) {
        if (smartLoanContract) {
          let collectedResponse;
          let collectedToken;
          let harvested;
          if (window.arbitrumChain) {
            collectedResponse = await (await fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/arbitrum-grant/${smartLoanContract.address}`)).json();
            harvested = LTIP_DISTRIBUTED_ARBITRUM[this.smartLoanContract.address.toLowerCase()] ? LTIP_DISTRIBUTED_ARBITRUM[this.smartLoanContract.address.toLowerCase()] : 0;
            collectedToken = collectedResponse.total;
          }
          this.collectedBonus = collectedToken - harvested;

          this.wrappedContract = await wrapContract(this.smartLoanContract);

          //TODO: to LeChiffre- is it a right place for such a call?
          this.yourEligibleTVL = fromWei(await this.wrappedContract.getLTIPEligibleTVL());
        }
      },
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.ltip-stats-bar-component {
  display: flex;
  flex-direction: column;
  height: 130px;
  margin-top: 30px;
  padding: 0 53px;
  border-radius: 35px;
  background-color: var(--ltip-stats-bar__background);
  box-shadow: var(--ltip-stats-bar__box-shadow);

  .ltip__title {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    width: 100%;
    color: var(--ltip-stats-bar-text__color);
    font-size: $font-size-sm;
    font-weight: 600;
    padding: 6px 0;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;
  }

  .stats-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 22px 0 27px 0;
    margin: 0 -40px;

    .stat__entry {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: $font-size-xsm;
      font-weight: 500;
      color: var(--ltip-stats-bar-text__color);
      width: 100%;

      .stat-label {
        display: flex;
        flex-direction: row;
        align-items: center;
        font-size: $font-size-xsm;
        font-weight: 500;
        color: var(--ltip-stats-bar-text__color);
        margin-bottom: 12px;

        .info__icon {
          margin-left: 5px;
        }
      }

      .stat-value {
        display: flex;
        flex-direction: row;
        align-items: center;
        font-size: $font-size-xsm;
        font-weight: 600;
        color: var(--ltip-stats-bar-value__color);

        .incentives-icon {
          width: 16px;
          height: 16px;
          margin-left: 5px;
        }

        .shine-icon {
          width: 20px;
          height: 20px;
          margin-left: 5px;
          background-image: var(--ltip-stats-bar-value-icon);
        }
      }
    }
  }
}

</style>
