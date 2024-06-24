<template>
<div class="ltip-stats-bar-component">
  <div class="ltip__title">LTIPP Incentives Program</div>
  <div class="stats-row">
    <div class="stat__entry">
      <div class="stat-label">
        Total eligible TVL
        <InfoIcon class="info__icon"
                  :tooltip="{content: 'The total dollar value of all positions that are eligible for incentives.', classes: 'info-tooltip'}"
                  :classes="'info-tooltip'">
        </InfoIcon>
      </div>
      <div class="stat-value">{{ totalEligibleTVL | usd }}</div>
    </div>
    <div class="stat__entry">
      <div class="stat-label">
        Mission completion
        <InfoIcon class="info__icon"
                  :tooltip="{content: 'How close we are to completing the next protocol mission.', classes: 'info-tooltip'}"
                  :classes="'info-tooltip'">
        </InfoIcon>
      </div>
      <div class="stat-value">
        <bar-gauge-beta v-tooltip="{content: `Community mission completion: $${(totalEligibleTVL / 1000000).toFixed(1)}M / $${milestone / 1000000}M`, classes: 'info-tooltip'}"
                        :min="0" :max="milestone" :value="totalEligibleTVL" :width="108" :green-on-completion="true"></bar-gauge-beta>
      </div>
    </div>
    <div class="stat__entry">
      <div class="stat-label">
        Your eligible TVL
        <InfoIcon class="info__icon"
                  :tooltip="{content: 'The dollar value you receive ARB emissions over. This is calculated as: Total LP/Farms deposits - Collateral value.', classes: 'info-tooltip'}"
                  :classes="'info-tooltip'">
        </InfoIcon>
      </div>
      <div class="stat-value">{{ yourEligibleTVL | usd }}</div>
    </div>
    <div class="stat__entry">
      <div class="stat-label">
        1x APR Boost
        <InfoIcon class="info__icon"
                  :tooltip="{content: 'The APR you receive over your eligible TVL.', classes: 'info-tooltip'}"
                  :classes="'info-tooltip'">
        </InfoIcon>
      </div>
      <div class="stat-value">
        {{ boostApy | percent }}
        <span
          class="speed-bonus"
          v-tooltip="{content: `An additional bonus provided to all participants if the mission is completed within 7 days. It is not included in your Account APY.` }"
          :class="{'speed-bonus-active': speedBonusActive}"
      >&nbsp;(+{{speedBonus | percent}})</span>
        <div class="shine-icon"></div>
      </div>
    </div>
    <div class="stat__entry">
      <div class="stat-label">
        Max APR boost
        <InfoIcon class="info__icon"
                  :tooltip="{content: 'The boost APR received if you would borrow enough to get health to 10%, and put your total value into LP/Farms.', classes: 'info-tooltip'}"
                  :classes="'info-tooltip'">
        </InfoIcon>
      </div>
      <div class="stat-value">
        {{ maxBoostApy | percent }}
        <span
            class="speed-bonus"
            v-tooltip="{content: `Maximum bonus boost for completing the mission.` }"
            :class="{'speed-bonus-active': speedBonusActive}"
        >&nbsp;(+{{4.5 * speedBonus | percent}})</span>
        <div class="shine-icon"></div>
      </div>
    </div>
    <div class="stat__entry">
      <div class="stat-label">
        ARB collected
        <InfoIcon class="info__icon"
                  :tooltip="{content: 'The total amount of ARB you have collected this week. Collected ARB will be distributed weekly. This number is not included in your collateral value, until the ARB is distributed to all Prime Accounts. This number resets to 0 after the collected ARB is added to your assets.', classes: 'info-tooltip'}"
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
import LTIP_DISTRIBUTED_ARBITRUM from "../data/arbitrum/ltip/LTIP_EPOCH_3.json";
import {fromWei} from "../utils/calculate";
import {mapState} from "vuex";
import {wrapContract} from "../utils/blockchain";
import config from "../config";
import {maxInt8} from "viem";
import {combineLatest, endWith} from "rxjs";

export default {
  name: 'LTIPStatsBar',
  components: {InfoIcon, BarGaugeBeta},
  data() {
    return {
      wrappedContract: null,
      totalEligibleTVL: 0,
      milestone: config.ltipMilestone,
      yourEligibleTVL: 0,
      speedBonus: 0,
      boostApy: 0,
      maxBoostApy: 0,
      collectedBonus: 0,
      speedBonusActive: false
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
    ...mapState('serviceRegistry', ['ltipService', 'priceService']),
  },
  methods: {
    maxInt8() {
      return maxInt8
    },
    watchLtipDataUpdate() {
      combineLatest([this.priceService.observeRefreshPrices(), this.ltipService.observeLtipTotalEligibleTvlData(), this.ltipService.observeLtipTotalEligibleTvls()])
      .subscribe(([, tvl, tvls]) => {
        if (tvl) {
          this.totalEligibleTVL = tvl;

          let week = 7 * 24 * 3600;

          this.speedBonusActive = this.totalEligibleTVL >= config.ltipMilestone;

          let startTimestamp;
          let endTimestamp;

          if (this.speedBonusActive) {
            let sorted = tvls.sort((a,b ) => a.id - b.id);
            endTimestamp = sorted.find(a => a.totalEligibleTvl > config.ltipMilestone).id
            startTimestamp = sorted.find(a => a.totalEligibleTvl > config.previousLtipMilestone).id
          } else {
            endTimestamp = Date.now() / 1000;
            startTimestamp = config.lastMilestoneHit;
          }

          this.speedBonus = this.assets['ARB'] ? 9166.66 * this.assets['ARB'].price / 7 * 365 / config.ltipMilestone *  Math.max((week - (endTimestamp - startTimestamp))  / week, 0) : 0;
        }
      });
      this.ltipService.observeLtipPrimeAccountEligibleTvl().subscribe((tvl) => {
        if (tvl) this.yourEligibleTVL = tvl;
      });
      this.ltipService.observeLtipPrimeAccountArbCollected().subscribe((arbCollected) => {
        let alreadyCollectedRecord = Object.entries(LTIP_DISTRIBUTED_ARBITRUM).find(([k,v]) => k.toLowerCase() === this.smartLoanContract.address.toLowerCase());
        alreadyCollectedRecord = alreadyCollectedRecord ? alreadyCollectedRecord[1] : 0;
        if (arbCollected) this.collectedBonus = Math.max(arbCollected - alreadyCollectedRecord, 0);
      });
      this.ltipService.observeLtipMaxBoostApy().subscribe((apy) => {
        if (apy) {
          this.maxBoostApy = apy;
          this.boostApy = this.maxBoostApy / 4.5;
        }
      });
    }
  },
  watch: {
    smartLoanContract: {
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
        EPOCH_1.json
        .speed-bonus {
          opacity: 50%;

          &.speed-bonus-active {
            opacity: 100%;
            color: var(--colored-value-beta__color--positive);
          }
        }
      }
    }
  }
}

</style>
