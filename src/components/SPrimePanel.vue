<template>
  <div class="sprime-panel-component">
    <div class="sprime-panel__actions">
      <div class="sprime">
        <img src="src/assets/icons/sprime-icon.svg">
        $sPRIME
      </div>
      <div class="actions">
        <FlatButton :active="true">mint</FlatButton>
        <FlatButton :active="true">deposit</FlatButton>
        <FlatButton :active="true">rebalance</FlatButton>
        <FlatButton :active="true">withdraw</FlatButton>
        <FlatButton :active="true">redeem</FlatButton>
      </div>
    </div>
    <div class="sprime-panel__body">
      <div class="stats">
        <div class="stat">
          <div class="stat__title">Total value</div>
          <div class="stat__value">{{50.31 | usd}}</div>
        </div>
        <div class="stat">
          <div class="stat__title">Revenue received</div>
          <div class="stat__value">{{50.31 | usd}}</div>
        </div>
        <div class="stat">
          <div class="stat__title">YTD APR</div>
          <div class="stat__value">{{0.15512 | percent}}</div>
        </div>
      </div>
      <div class="distribution">
        Distribution
      </div>
      <div class="governance">
        <div class="governance__power">
          Governance power
          <div class="power__gauge">
            <div class="gauge__value">
              265
            </div>
          </div>
        </div>
        <div class="rates"></div>
      </div>
    </div>
  </div>
</template>

<script>

import FlatButton from './FlatButton.vue';

export default {
  name: 'SPrimePanel',
  components: {FlatButton},
  props: {},
  data() {
    return {};
  },
  mounted() {
  },
  watch: {},
  methods: {}
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.sprime-panel-component {
  display: flex;
  flex-direction: column;
  border-radius: 35px;
  background-color: var(--ltip-stats-bar__background);
  box-shadow: var(--ltip-stats-bar__box-shadow);
  margin-top: 30px;

  .sprime-panel__actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 16px 0;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;

    .sprime {
      margin-right: 30px;
    }

    .actions {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;

      .flat-button-component:not(:last-child) {
        margin-right: 10px;
      }
    }
  }

  .sprime-panel__body {
    padding: 30px 50px;
    display: grid;
    grid-template-columns: 250px 1fr 420px;

    .stats {
      display: flex;
      flex-direction: column;
      border-style: solid;
      border-width: 0 2px 0 0;
      border-image-source: var(--stats-bar-beta__divider-background);
      border-image-slice: 1;

      .stat {
        display: flex;
        flex-direction: column;
        margin-bottom: 24px;

        .stat__title {
          font-size: 16px;
          font-weight: 500;
          color: #696969;
        }

        .stat__value {
          font-size: 18px;
          font-weight: 500;
          color: #000;
        }
      }
    }

    .distribution {

    }

    .governance {

      .governance__power {

        .power__gauge {
          width: 130px;
          height: 130px;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          box-shadow: 2px 2px 10px 0 rgba(191, 188, 255, 0.9);
          border-radius: 65px;
          border-style: solid;
          border-width: 2px;
          border-image-source: linear-gradient(to right, #dfe0ff, #ffe1c2 48%, #ffd3e0);
          border-image-slice: 1;

          .gauge__value {
            font-size: 44px;
            font-weight: 600;
            color: #9a97ff;
          }
        }
      }

      .rates {

      }
    }
  }
}


</style>
