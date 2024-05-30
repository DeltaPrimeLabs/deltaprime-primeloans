<template>
  <div class="paginator-component">
    <div class="paginator">
      <div class="paginator__button paginator__previous" v-on:click="previousPage()">
        <IconButton :disabled="currentPage === 1"
                    :icon-src="'src/assets/icons/icon_previous_off.svg'" :size="20"></IconButton>
      </div>
      <div class="paginator__text">
        Page {{ currentPage  }} of {{ totalPages }}
      </div>
      <div class="paginator__button paginator__next" v-on:click="nextPage()">
        <IconButton :disabled="currentPage === totalPages"
                    :icon-src="'src/assets/icons/icon_next_on.svg'" :size="20"></IconButton>
      </div>
    </div>
  </div>
</template>

<script>
import IconButton from "./IconButton.vue";

export default {
  name: 'Paginator',
  components: {IconButton},
  props: {
    startPage: 1,
    pageSize: null,
    totalElements: null,
  },

  data() {
    return {
      previousDisabled: null,
      nextDisabled: null,
      totalPages: null,
      currentPage: 1
    }
  },

  mounted() {
    this.setup();
  },

  methods: {
    setup() {
      this.totalPages = Math.max(Math.ceil(this.totalElements / this.pageSize) - 1, 1); //TODO: check this - 1
    },

    nextPage() {
      if (this.currentPage !== this.totalPages) {
        this.currentPage++;
        this.nextDisabled = this.currentPage === this.totalPages;
        this.$emit('pageChange', this.currentPage);
      }
    },

    previousPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.previousDisabled = this.currentPage === 1;
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

    .paginator__text {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      width: 110px;
      margin: 0 12px;
      font-size: $font-size-xsm;
      font-weight: 500;
      color: var(--paginator__text-color);
    }
  }
}

</style>
