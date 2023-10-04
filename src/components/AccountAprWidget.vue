<template>
  <div class="account-apr-widget-component">
    <div class="apr-widget__title">
      Account APY
      <InfoIcon class="info__icon" :tooltip="{content: 'How much you annually yield on your collateral. This number includes any inherent asset price appreciation, and borrowing interest.', placement: 'top', classes: 'info-tooltip'}" :classes="'info-tooltip'" ></InfoIcon>
    </div>
    <div class="apr-widget__value">
      <ColoredValueBeta v-if="accountApr != null" :value="accountApr ? accountApr : 0" :formatting="'percent'"
                        :percentage-rounding-precision="1" :big="true"></ColoredValueBeta>
      <div v-else>
        <div class="no-smart-loan-dash" v-if="noSmartLoan">
        </div>
        <div v-else>
          <vue-loaders-ball-beat color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
        </div>
      </div>
    </div>
    <div class="apr-widget__comment">
      {{ comment }}
    </div>
  </div>
</template>

<script>
import ColoredValueBeta from './ColoredValueBeta';
import InfoIcon from "./InfoIcon.vue";

export default {
  name: 'AccountAprWidget',
  components: {InfoIcon, ColoredValueBeta},
  props: {
    accountApr: 0,
    noSmartLoan: {}
  },
  data() {
    return {
      possibleComments: null,
      comment: null,
    };
  },
  mounted() {
    this.setupCommentConfig();
    this.pickComment();
  },
  watch: {
    accountApr: {
      handler() {
        this.pickComment();
      }
    },
    noSmartLoan: {
      handler() {
        this.pickComment();
      },
    }
  },
  methods: {
    setupCommentConfig() {
      // max is inclusive, min is not
      this.possibleComments = [
        {
          text: 'Steady lads…',
          min: -999999,
          max: -0.5
        },
        {
          text: 'Let\'s short!',
          min: -0.5,
          max: -0.1
        },
        {
          text: 'Let’s set up those strats.',
          min: -0.1,
          max: 0.1
        },
        {
          text: 'You are doing great!',
          min: 0.1,
          max: 0.5
        },
        {
          text: 'Degen, activated!',
          min: 0.5,
          max: 9999999999
        }
      ];
    },

    pickComment() {
      let pickedComment;
      if (this.accountApr !== null) {
        console.log('this.accountApr: ', this.accountApr)
        console.log(this.possibleComments)
        pickedComment = this.possibleComments.find((comment) => this.accountApr > comment.min && this.accountApr <= comment.max);
      } else {
        if (this.noSmartLoan) {
          pickedComment = {text: 'No account'};
        } else {
          pickedComment = {text: 'Loading...'};
        }
      }
      this.comment = pickedComment.text;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.account-apr-widget-component {
  width: 222px;
  height: 107px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-shadow: var(--account-apr-widget-component__box-shadow);
  background-color: var(--account-apr-widget-component__background);
  border-bottom-left-radius: 35px;
  border-bottom-right-radius: 35px;

  .apr-widget__title {
    font-size: $font-size-sm;
    font-weight: 500;
    color: var(--account-apr-widget-component__widget-title-color);
    margin-bottom: 4px;
  }

  .apr-widget__value {
    margin-bottom: 2px;

    .no-smart-loan-dash {
      margin: 14px 0;
      width: 20px;
      height: 1px;
      background-color: $steel-gray;
    }
  }

  .apr-widget__comment {
    font-size: $font-size-xsm;
    color: var(--account-apr-widget-component__widget-comment-color);
  }

  .info__icon {
    transform: translateY(-2px);
  }
}

</style>
