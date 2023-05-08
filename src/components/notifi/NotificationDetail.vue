<template>
  <div class="notification-detail">
    <div v-if="screenLoading" class="loader">
      <VueLoadersBallBeat color="#A6A3FF" scale="1"></VueLoadersBallBeat>
    </div>

    <template v-if="!screenLoading">
      <div class="notifi-modal__text-small text__time">
        {{ notification.createdDate|notificationTime }}
      </div>

      <div class="notifi-modal__text notifi-modal__notification-title detail-subject">
        {{ detailSubject }}
      </div>

      <div class="notifi-modal__text notifi-modal__text-small detail-message">
        {{ detailMessage }}
      </div>
    </template>
  </div>
</template>

<script>

export default ({
  name: 'NotificationDetail',
  components: {},
  props: {
    notification: { type: Object, default: () => {} },
    screenLoading: { type: Boolean, default: false }
  },
  data() {
    return {}
  },
  computed: {
    detailSubject() {
      return this.notification.category === "CREATOR_MESSAGE"
            ? this.notification.detail.subject
            : this.notification.detail.sourceName;
    },

    detailMessage() {
      return this.notification.category === "CREATOR_MESSAGE"
            ? this.notification.detail.message
            : this.notification.detail.genericMessage
    }
  },
  methods: {}
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/notifi";

.notification-detail {
  height: 470px;
  padding: 24px 30px;
  display: flex;
  flex-direction: column;

  .detail-subject {
    margin-top: 4px;
  }

  .detail-message {
    margin-top: 10px;
  }
}
</style>