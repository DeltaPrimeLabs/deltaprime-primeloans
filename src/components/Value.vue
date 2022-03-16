<template>
  <div class="value-wrapper">
    <div class="label">{{label}}</div>
    <div class="values" v-if="primary.value !== null">
      <div class="value">
        <img class="logo" v-if="primary.showIcon" :src="`src/assets/icons/${primary.type}-icon.svg`"/>
        <div>{{format(primary.value, primary.type, primary.arg)}}</div>
      </div>
      <div v-if="secondary" class="sub-value">
        <img class="logo" v-if="secondary.showIcon" :src="`src/assets/icons/${secondary.type}-icon.svg`"/>
        <div v-if="secondary.value != null">{{secondary.showIcon ? secondary.value : format(secondary.value, secondary.type, primary.arg)}}</div>
      </div>
    </div>
    <vue-loaders-ball-beat v-else color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
  </div>
</template>

<script>
  export default {
    name: 'Value2',
    props: {
      label: String,
      primary: {},
      secondary: {}
    },
    data() {
      return {
      }
    },
    methods: {
      format(value, filter, arg) {
        return this.$options.filters[filter](value, arg);
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.value-wrapper {
  display: flex;
  flex-direction: row;

  align-items: flex-start;
  justify-content: space-between;

  @media screen and (min-width: $md) {
    flex-direction: column;
    align-items: center;
    justify-content: initial;
    width: 200px;
  }

  vue-loaders-ball-beat {
    margin-top: 8px;

    @media screen and (min-width: $md) {
      margin-top: 0;
    }
  }
}

.label {
  white-space: nowrap;
  width: 50%;
  margin-top: 10px;
  height: 50px;

  @media screen and (min-width: $md) {
    margin-top: 0;
    width: initial;
    height: initial;
  }
}

.value, .sub-value {
  display: flex;
  align-items: center;
}

.value {
  margin: 5px 0;
  font-size: $font-size-mlg;
}

.sub-value {
  margin-left: 5px;
  color: #7d7d7d;
  font-size: $font-size-xsm;
}

.values {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 5px;
  justify-content: center;
}

.logo {
  margin-right: 5px;
  opacity: 0.7;
  height: 20px;

  @media screen and (min-width: $md) {
    height: 24px;
  }
}

</style>

