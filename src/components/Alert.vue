<template>
  <div class="alert-component">
    <div class="alert-content">
      <img src="src/assets/icons/warning.svg" class="warning"/>
      <div class="text">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script>
  export default {
    name: 'Alert',
    props: {},
    methods: {},
    computed: {}
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
.alert-component {
  width: 100%;
  display: flex;
  padding: 10px;
  border: 1px solid #ff9100;
  border-radius: 10px;
  background-color: #ff91009e;
  .alert-content {
    display: flex;
    font-weight: 500;
    color: white;
    font-size: $font-size-sm;
    @media screen and (min-width: $md) {
      font-size: $font-size-xsm;
    }
    .warning {
      margin-right: 20px;
      height: 100%;
    }
    .text {
      text-align: left;
    }
  }
}
</style>