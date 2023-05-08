<template>
  <div
    class="add-interest-rate"
  >
    <div
      class="add-rate-btn"
      @click="newWindow = true"
    >
      <img src="src/assets/icons/icon_a_plus_single.svg">
      Add Rate
    </div>
  </div>
</template>

<script>
export default ({
  name: 'AddInterestRate',
  components: {},
  props: {},
  data() {
    return {
      newWindow: false
    }
  },
  methods: {}
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.add-interest-rate {
  .add-rate-btn {
    display: flex;
    font-size: $font-size-xsm;
    font-weight: 600;
    color: var(--edit-contact__contact-verify-color);
    cursor: pointer;
    transform: translateX(-3px);
  }
}
</style>