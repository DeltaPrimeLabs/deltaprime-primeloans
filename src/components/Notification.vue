<template>
  <div class="notification-wrapper">
    <div class="notification-content">
      <img src="src/assets/icons/warning.svg" class="warning"/>
      <div class="text">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script>
  export default {
    name: 'Notification',
    props: {
    },
    methods: {
    },
    computed: {
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.notification-wrapper {
  width: 100%;
  display: flex;
  margin-top: 20px;
  padding: 10px;
  border: 1px solid #ff9100;
  border-radius: 10px;
  background-color: #ff91009e;

  .notification-content {
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

