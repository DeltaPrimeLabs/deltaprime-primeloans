<template>
  <div class="paginator-component">
    <div class="paginator">
      <div class="paginator__button paginator__previous" v-on:click="previousPage()">
        <img v-if="currentPage === 0" class="icon icon__disabled" src="src/assets/icons/icon_previous_off.svg">
        <img v-if="currentPage > 0" class="icon icon__active" src="src/assets/icons/icon_next_on.svg">
      </div>
      <div class="paginator__text">
        Page {{ currentPage + 1 }} of {{ totalPages }}
      </div>
      <div class="paginator__button paginator__next" v-on:click="nextPage()">
        <img v-if="currentPage === totalPages" class="icon icon__disabled" src="src/assets/icons/icon_previous_off.svg">
        <img v-if="currentPage < totalPages" class="icon icon__active" src="src/assets/icons/icon_next_on.svg">
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Paginator',
  props: {
    pageSize: null,
    totalElements: null,
  },

  data() {
    return {
      previousDisabled: null,
      nextDisabled: null,
      totalPages: null,
      currentPage: 0,
    }
  },

  mounted() {
    this.setup();
  },

  methods: {
    setup() {
      this.totalPages = Math.ceil(this.totalElements / this.pageSize);
    },

    nextPage() {
      if (this.currentPage !== this.totalPages) {
        this.currentPage++;
        this.nextDisabled = this.currentPage === this.totalPages;
        this.$emit('pageChange', this.currentPage);
      }
    },

    previousPage() {
      if (this.currentPage > 0) {
        this.currentPage--;
        this.previousDisabled = this.currentPage === 0;
        this.$emit('pageChange', this.currentPage);
      }

    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.paginator-component {

  .paginator {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    margin: 16px 20px 0 0;

    .paginator__button {
      cursor: pointer;

      .icon {
        user-select: none;
      }
    }

    .paginator__previous {

      .icon__active {
        transform: rotate(180deg);
      }
    }

    .paginator__next {

      .icon__disabled {
        transform: rotate(180deg);
      }
    }

    .paginator__text {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      width: 110px;
      margin: 0 12px;
      font-size: $font-size-xsm;
      font-weight: 500;
      color: $steel-gray;
    }
  }
}

</style>