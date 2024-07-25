<template>
  <div class="wrapper">
    <div class="border">
      <div class="bordered-button" @click="action">
        <slot/>
      </div>
    </div>
  </div>
</template>
<script>

export default {
  props: {
    label: String,
    action: Function
  }
}
</script>
<style lang="scss" scoped>
.border {
  background: linear-gradient(180deg, rgba(#fec2a5, 1), rgba(#fa91bf, 1), rgba(#babafe, 1));
  padding: 3px;
  border-radius: 9999999999999px;
  transition: all 0.2s linear;
  box-shadow: 8px 10px 26px 0 rgba(35, 8, 94, 0.21), 2px 2px 6px 0 rgba(48, 34, 105, 0.4);
  cursor: pointer;

  &:hover {
    background: linear-gradient(to bottom, rgba(#babafe, 1), rgba(#fa91bf, 1), rgba(#fec2a5, 1));

    .bordered-button {
      background-image: linear-gradient(to bottom, #8885fb, #8885fb), linear-gradient(to bottom, #babafe 0%, #fa91bf 54%, #fec2a5 107%);
    }
  }
}

.bordered-button {
  font-size: 16px;
  font-weight: 700;
  color: white;
  padding: 14px 20px 14px 20px;
  position: relative;
  background: #6b70ed;
  border-radius: 9999999999999px;
  width: min-content;
  white-space: nowrap;
  display: flex;
  align-items: center;
}
</style>
