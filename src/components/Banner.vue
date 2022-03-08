<template>
  <div class="banner">
    <div class="elements">
      <slot></slot>
    </div>
  </div>
</template>


<script>
  export default {
    name: 'Banner',
    props: {
      title: String
    },
    data() {
      return {

      }
    },
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.banner {
  top: 0;
  height: 60px;
  display: flex;
  background-color: #F4D35E;
  width: 100%;
  justify-content: space-around;
  align-items: center;
  z-index: 2;
  box-shadow: 0px 5px 19px 0px rgba(0, 0, 0, 0.2);

  a {
    cursor: pointer;
  }
}
</style>

