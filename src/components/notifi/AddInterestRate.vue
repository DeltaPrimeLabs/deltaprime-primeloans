<template>
  <div
    class="add-interest-rate"
  >
    <div
      v-if="!newWindow"
      class="add-rate-btn"
      @click="handleClick"
    >
      <img src="src/assets/icons/icon_a_plus_single.svg">
      Add Rate
    </div>
    <div
      v-if="newWindow"
      class="new-window"
    >

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
  methods: {
    handleClick() {
      this.newWindow = true;

      const rateOptions = {
        threshold: 0.14,
        thresholdDirection: 'below',
        poolAddress: '0xD7fEB276ba254cD9b34804A986CE9a8C3E359148',
      }
      this.$emit('borrowInterestRate', rateOptions);
    }
  }
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.add-interest-rate {
  display: flex;
  .add-rate-btn {
    display: flex;
    font-size: $font-size-xsm;
    font-weight: 600;
    color: var(--edit-contact__contact-verify-color);
    cursor: pointer;
    transform: translateX(-3px);
  }

  .new-window {

  }
}
</style>