<template>
  <div class="name-value-badge-component">
    <div class="name-value-badge">
      <div class="content">
        <div class="name">
          {{ name }}:
        </div>
        <div class="value">
          <slot></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'NameValueBadgeBeta',
  props: {
    name: {
      type: String,
      required: true,
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.name-value-badge {
  background-image: var(--name-value-badge-beta__background);
  border-radius: 25px;
  display: inline-block;
  height: 40px;
  padding: 2px;

  .content {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    padding: 0 20px;
    border-radius: 18px;
    background: var(--name-value-badge-beta__content-background);
    font-size: $font-size-md;

    .name {
      margin-right: 8px;
    }

    .value {
      font-weight: 500;
    }
  }
}

</style>
