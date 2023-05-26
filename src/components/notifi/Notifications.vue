<template>
  <div
    class="notifications-list notifi-modal__scroll"
    @scroll="handleScroll"
  >
    <div
      v-for="(notification, id) in notifications"
      v-if="notification.detail"
      v-bind:key="id"
      class="notification-box"
      @click.stop="handleDetail(notification)"
    >
      <div class="box-icon">
        <img :src="getBoxIcon(notification)">
      </div>

      <div class="box-text">
        <div class="notifi-modal__text notifi-modal__notification-title">
          {{ getBoxTitle(notification) }}
        </div>

        <div class="notifi-modal__text notifi-modal__text-info text__info">
          {{ getBoxMessage(notification) }}
        </div>

        <div class="notifi-modal__text notifi-modal__text-small text__time">
          {{ notification.createdDate|notificationTime }}
        </div>
      </div>
    </div>
    <div
      v-if="pageInfo.hasNextPage"
      class="history-spinner"
    >
      <VueLoadersBallBeat color="#A6A3FF" scale="1"></VueLoadersBallBeat>
    </div>
    <div
      v-if="notifications && notifications.length == 0"
      class="empty-history"
    >
      <img class="empty-top-icon" src="src/assets/icons/icon_alert_big.svg">
      <div class="notifi-modal__text notifi-modal__notification-title">
        No notifications yet :)
      </div>
      <div class="notifi-modal__text notifi-modal__text-info empty-info">
        We'll let you know if anything comes up!
      </div>
    </div>
    <div v-if="!notifications || screenLoading" class="loader">
      <VueLoadersBallBeat color="#A6A3FF" scale="1"></VueLoadersBallBeat>
    </div>
  </div>
</template>

<script>
import notifiConfig from './notifiConfig';
import { mapState } from 'vuex';

export default ({
  name: 'Notifications',
  components: {},
  props: {
    screenLoading: { type: Boolean, default: false },
    history: { type: Object, default: () => {} }
  },
  data() {
    return {
      notifications: this.history.nodes,
      pageInfo: this.history.pageInfo,
      iconsConfig: notifiConfig.NOTIFICATION_ICONS_CONFIG,
      theme: null
    }
  },
  computed: {
    ...mapState('serviceRegistry', ['notifiService', 'themeService']),
  },
  mounted() {
    this.watchHistory();
    this.watchThemeChange();
  },
  methods: {
    watchHistory() {
      this.notifiService.observeLoadHistory().subscribe((moreHistory) => {
        this.notifications = [...this.notifications, ...moreHistory.nodes];
        this.pageInfo = moreHistory.pageInfo;
      });
    },

    watchThemeChange() {
      this.themeService.observeThemeChange().subscribe((theme) => {
        this.theme = theme;
      })
    },

    getBoxIcon(notification) {
      if (notification.category === 'CREATOR_MESSAGE') {
        return this.iconsConfig.Announcement[this.theme];
      }

      const sourceName = Object.keys(this.iconsConfig).find(key => notification.detail.sourceName.includes(key));
      return this.iconsConfig[sourceName] && this.iconsConfig[sourceName][this.theme];
    },

    getBoxTitle(notification) {
      return notification.category === 'CREATOR_MESSAGE' 
            ? 'DeltaPrime Announcements'
            : notification.detail.notificationTypeName;
    },

    getBoxMessage(notification) {
      return notification.category === 'CREATOR_MESSAGE'
            ? notification.detail.message
            : notification.detail.genericMessage
    },

    handleDetail(notification) {
      this.$emit('notificationDetail', notification);
    },

    handleScroll({ target: { scrollTop, clientHeight, scrollHeight }}) {
      if (scrollTop + clientHeight >= scrollHeight && this.pageInfo.hasNextPage) {
        this.$emit('loadMoreHistory', this.pageInfo.endCursor);
      }
    }
  }
})
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/notifi";

.notifications-list {
  height: 470px;

  .notification-box {
    display: flex;
    padding: 16px;
    border-bottom: solid 1px var(--notifi-modal__container-inner-border-color);
    cursor: pointer;

    .box-icon {
      margin-right: 14px;

      img {
        width: 100%;
        object-fit: contain;
      }
    }

    .box-text {
      display: flex;
      flex-direction: column;
      width: 100%;

      .text__info {
        margin-top: 4px;
        padding-right: 5px;
        overflow: hidden;
        display: -webkit-box;
        line-clamp: 2;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .text__time {
        margin-top: 8px;
      }
    }

    &:hover {
      background: var(--notifi-modal__container-notification-box-hover-color);
    }
  }

  .empty-history {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 60px;

    .empty-top-icon {
      width: 60px;
      object-fit: contain;
      margin-bottom: 16px;
    }

    .empty-info{
      margin-top: 10px;
      width: 172px;
      text-align: center;
    }
  }

  .history-spinner {
    width: 100%;
    height: 50px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
}

</style>