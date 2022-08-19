<template>
  <div class="transaction-result-summary-beta-component">
    <div class="summary-wrapper">
      <div class="summary">
<!--        <div class="summary__title">
          Values after transaction:
        </div>
        <div class="summary__values">
          <div class="summary__label">
            LTV:
          </div>
          <div class="summary__value">
            {{2.511 | percent}}
          </div>
          <BarGaugeBeta :min="0" :max="5" :value="2.511" :slim="true"></BarGaugeBeta>
          <div class="summary__divider"></div>
          <div class="summary__label">
            Balance:
          </div>
          <div class="summary__value">
            73.12 AVAX
          </div>
        </div>-->
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script>
import BarGaugeBeta from './BarGaugeBeta';
export default {
  name: 'TransactionResultSummaryBeta',
  components: {BarGaugeBeta}
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.summary-wrapper {
  background-image: linear-gradient(117deg, #dfe0ff 39%, #ffe1c2 62%, #ffd3e0 82%);
  border-radius: 15px;
  display: inline-block;
  padding: 2px;
  width: 100%;

  .summary {
    display: flex;
    flex-direction: column;
    border-radius: 13px;
    background-color: white;
    padding: 16px 0 18px 30px;

    .summary__title {
      display: flex;
      flex-direction: row;
      color: $steel-gray;
      font-size: $font-size-xsm;
      margin-bottom: 14px;
    }

    .summary__values {
      display: flex;
      flex-direction: row;
      color: $steel-gray;

      .currency {
        font-weight: 400;
      }

      .summary__label {
        margin-right: 5px;

        &.summary__label--error {
          color: $red;
          font-weight: 600;
        }
      }

      .summary__divider {
        width: 2px;
        height: 17px;
        background-color: $smoke-gray;
        margin: 0 10px;
      }

      .summary__value {
        font-weight: 600;
        margin-right: 5px;

        .summary__value--error {
          color: $red;
        }
      }
    }
  }
}

</style>