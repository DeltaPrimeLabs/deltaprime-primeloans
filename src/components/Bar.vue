<template>
  <div class="bar"> 
    <div v-if="title" class="title"></div>
    <div class="elements">
      <slot></slot>
    </div>  
  </div>
</template>


<script>
  export default {
    name: 'Bar',
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

.bar {
  border-radius: 25px;
  box-shadow: 7px 7px 30px 0 rgba(191, 188, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.3);
  font-weight: 500;
  padding: 1rem 1.5rem;

  @media screen and (min-width: $md) {
      padding: 0 110px 30px 110px;
  }

  .rate-wrapper {
    width: max-content;
    height: 35px;
    margin: auto;
    margin-bottom: 18px;
    padding: 8px 40px;
    border-bottom-left-radius: 15px;
    border-bottom-right-radius: 15px;
    box-shadow: 0 2px 6px 0 rgba(191, 188, 255, 0.25);
    background-color: rgba(255, 255, 255, 0.8);
    font-size: 16px;
    color: #696969;
    font-weight: 400;

    .rate {
      font-weight: 600;
    }
  }

  .stats {
    display: flex;
    justify-content: space-between;
  }
}
</style>

