<template>
  <div class="protected-by-bar-component">
    <div class="text">Protected by</div>
    <a class="logo peck-shield" href="https://peckshield.com/" target="_blank"></a>
    <div class="divider"></div>
    <a class="logo chainalysis" href="https://www.chainalysis.com/" target="_blank"></a>
    <div class="divider"></div>
    <a class="logo fc-shield" href="https://fcshield.com/" target="_blank"></a>
    <div class="divider"></div>
    <a class="logo hexagate" href="https://www.hexagate.com/" target="_blank"></a>
    <div class="divider"></div>
    <a class="logo atomica" href="https://www.atomica.org/" target="_blank"></a>
    <div class="divider"></div>
    <a class="logo salus" href="https://salusec.io/" target="_blank"></a>
  </div>
</template>

<script>

export default {
  name: 'ProtectedByBar',
  components: {},
  data() {
    return {
    };
  },
  computed: {
  },
  mounted() {
  },

};
</script>

<style scoped lang="scss">
@import "~@/styles/variables";
.protected-by-bar-component {
  position: fixed;
  z-index: 3;
  bottom: 0;
  left: 0;
  height: 36px;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: var(--bar__background);

  .text {
    color: var(--bar__text-color);
    font-weight: 500;
    font-size: $font-size-xs;
  }

  .logo {
    background-repeat: no-repeat !important;
    margin: 0 20px;
    cursor: pointer;

    &.peck-shield {
      width: 75px;
      height: 15px;
      background: var(--bar__logo-peck-shield);

      &:hover {
        background: var(--bar__logo--hover-peck-shield);
      }
    }

    &.chainalysis {
      width: 80px;
      height: 14px;
      background: var(--bar__logo-chainalysis);

      &:hover {
        background: var(--bar__logo--hover-chainalysis);
      }
    }

    &.fc-shield {
      width: 77px;
      height: 16px;
      background: var(--bar__logo-fc-shield);

      &:hover {
        background: var(--bar__logo--hover-fc-shield);
      }
    }

    &.hexagate {
      width: 66px;
      height: 18px;
      background: var(--bar__logo-hexagate);
      background-size: cover !important;

      &:hover {
        background: var(--bar__logo--hover-hexagate);
      }
    }

    &.atomica {
      width: 64px;
      height: 18px;
      background: var(--bar__logo-atomica);

      &:hover {
        background: var(--bar__logo--hover-atomica);
      }
    }

    &.salus {
      width: 50px;
      height: 16px;
      background: var(--bar__logo-salus);

      &:hover {
        background: var(--bar__logo--hover-salus);
      }
    }
  }

  .divider {
    width: 1px;
    height: 14px;
    background-color: var(--bar__divider-background);
  }
}
</style>
