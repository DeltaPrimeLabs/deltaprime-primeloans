<template>
  <div class="notifi-login">
    <div class="notifi-modal__text notifi-modal__text-title login__title">
      {{ title }}
    </div>

    <div class="notifi-modal__text notifi-modal__text-info login__info">
      {{ topInfo }}
    </div>

    <div class="login__button-wrapper">
      <Button
        :label="'Connect to notifi'"
        @click.once="handleClick"
        :customStyle="customStyles.button"
        :waiting="screenLoading"
      ></Button>
    </div>
  </div>
</template>

<script>
import Button from '../Button';

export default ({
  name: 'Login',
  components: {
    Button
  },
  props: {
    title: String,
    topInfo: String,
    customStyles: { type: Object, default: () => {} },
    screenLoading: Boolean
  },
  data() {
    return {}
  },
  methods: {
    handleClick() {
      this.$emit('loginNotifi');
    }
  }
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/notifi";

.notifi-login {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 30px 75px;

  .login__info {
    margin-top: 12px;
    text-align: center;
  }

  .login__button-wrapper {
    margin-top: 30px;
  }
}
</style>