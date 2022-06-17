<template>
  <div class="currency-input-beta-component">
    <input class="currency-input" type="number" placeholder="0">
  </div>
</template>

<script>
export default {
  name: 'CurrencyInputBeta'
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.currency-input-beta-component {


  .currency-input {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 60px;
    box-shadow: inset 3px 3px 8px rgba(191, 188, 255, 0.5);
    background-image: linear-gradient(114deg, rgba(115, 117, 252, 0.08) 39%, rgba(255, 162, 67, 0.08) 62%, rgba(245, 33, 127, 0.08) 81%);
    border-radius: 15px;
    padding-left: 30px;
    border: none;
    outline: none;
    font-size: $font-size-xxl;
    font-weight: 600;
    font-family: Montserrat;

    &::-webkit-outer-spin-button, &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }
}

</style>