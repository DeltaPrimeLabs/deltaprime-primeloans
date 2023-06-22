<template lang="html">
  <div class="tabs">
    <ul ref="tabs" class='tabs-header'>
      <div ref="highlight" class="highlight"></div>
      <li v-for='(tab, index) in tabs'
          :key='tab.title'
          @click="selectTab(index)"
          :class="{
          'tab-selected': (index === selectedIndex)}">
        <div class="tab-button">
          <div :style="{'width': tab.titleWidth}">{{ tab.title }}</div>
        </div>
        <div class="tab-icon" v-bind:class="{'tab-icon--active': index === selectedIndex}">
          <img class="tab-icon__shadow" v-show="index === selectedIndex" :src="tab.tabIcon">
          <DeltaIcon class="tab-icon__icon" v-show="index === selectedIndex" :icon-src="tab.tabIcon"
                     :size="50"></DeltaIcon>
          <DeltaIcon class="tab-icon__icon" v-show="index !== selectedIndex" :icon-src="tab.tabIconSlim"
                     :size="50"></DeltaIcon>
        </div>
      </li>
    </ul>
    <div class="tab-window" v-bind:style="`min-height: ${tabHeight + 2}px;`">
      <div class="window-shade-left"></div>
      <div class="window-shade-right"></div>
      <div id="tab-bodies" class="tab-bodies" v-bind:style="`transform: translateX(${tabsShift}px);`">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script>
import DeltaIcon from './DeltaIcon.vue';
import ThemeToggle from './ThemeToggle.vue';

export default {
  components: {ThemeToggle, DeltaIcon},
  props: {
    mode: {
      type: String
    },
    openTabIndex: {
      type: Number,
      default: 0
    },
    arrow: false
  },
  data() {
    return {
      selectedIndex: this.openTabIndex,
      tabs: [],
      tabsShift: 0,
      tabHeight: 0,
    };
  },
  mounted() {
    this.tabs = Object.values(this.$scopedSlots.default()[0].context.$refs)
    this.selectTab(this.openTabIndex)
    setTimeout(() => {
      this.moveHighlightToSelectedTab();
      this.setupResizeObserver();
    });
  },
  methods: {
    selectTab(index) {
      this.tabsShift = index * -1230;
      this.selectedIndex = index;
      setTimeout(() => {
        this.moveHighlightToSelectedTab();
        let tabRect = this.tabs[this.selectedIndex].$el.getBoundingClientRect();
        this.tabHeight = tabRect.height;
        this.$emit('tabChange', this.selectedIndex);
        this.tabs[this.selectedIndex].$el.style.height = 'fit-content';
        this.tabs.filter((_, index) => index !== this.selectedIndex).forEach(tab => {
          tab.$el.style.height = `${tabRect.height}px`;
        })
      });

    },

    moveHighlightToSelectedTab() {
      this.$refs.highlight.style.left = `${this.$refs.tabs.children.item(this.selectedIndex + 1).offsetLeft - 12}px`;
      this.$refs.highlight.style.width = `${this.$refs.tabs.children.item(this.selectedIndex + 1).offsetWidth + 24}px`;
    },

    setupResizeObserver() {
      const assetsComponent = document.getElementsByClassName('funds-beta-component')[0]
      const farmsComponent = document.getElementsByClassName('stake-beta-component')[0]
      const statsComponent = document.getElementsByClassName('stats-container')[0]

      const resizeObserver = new ResizeObserver((events) => {
        for (const event of events) {
          if (this.selectedIndex === 2) {
            this.tabHeight = event.contentRect.height + 30;
          } else {
            this.tabHeight = event.contentRect.height;
          }
        }
      });

      resizeObserver.observe(farmsComponent);
      resizeObserver.observe(statsComponent);
    },
  },
  watch: {
    selectedIndex: function (value) {
      this.selectTab(value)
      this.$emit('tabChange', value);
    },
    openTabIndex: function (value) {
      this.selectedIndex = value;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

ul.tabs-header {
  position: relative;
  width: fit-content;
  height: 66px;
  display: flex;
  flex-direction: row;
  align-items: center;
  list-style: none;
  margin: 0 auto 20px auto;
  padding: 8px;
  justify-content: center;
  font-size: $font-size-md;
  background: var(--tabs__header-background-color);
  box-shadow: var(--tabs__header-box-shadow);
  border-radius: 999px;
  margin-top: 50px;

  @media screen and (min-width: $md) {
    font-size: $font-size-lg;
  }
}

ul.tabs-header .tab-button {
  border-radius: 10px;
  margin: 0;
  margin-right: 6px;
  display: flex;
  align-items: center;
}

.tab-button {
  display: inline-block;
  color: var(--tabs__tab-button-color);
}

.tab-icon {
  position: relative;
  width: 50px;
  height: 50px;
}

.tab-selected .tab-button {
  font-weight: bold;
  color: var(--tabs__tab-button-color--selected);
}

li {
  position: relative;
  display: flex;
  padding: 0 8px 0 12px;
  margin: 0 12px;
  cursor: pointer;
}

li:not(.tab-selected):hover {
  .tab-button {
    color: var(--tabs__tab-button-color--hover);
  }

  .tab-icon__icon {
    background-image: var(--tabs__tab-icon-icon-background--hover);
  }
}

.tabs {
  width: 100%;
}

.slash:not(.md-image) {
  align-self: center;
  height: 30px;

  @media screen and (min-width: $md) {
    height: 50px;
  }
}

.arrow:not(.md-image) {
  align-self: center;
  width: 25px;
  margin-left: 10px;

  @media screen and (min-width: $md) {
    width: 30px;
  }
}

.tab-icon__icon {
  position: absolute;
  background-image: var(--tabs__tab-icon-icon-background);
}

.tab-icon__shadow {
  position: absolute;
}

.tab-icon--active {
  .tab-icon__icon {
    background-image: var(--tabs__tab-icon-icon-background--selected);
  }

  .tab-icon__shadow {
    filter: var(--tabs__tab-icon-shadow--selected)
  }
}

.highlight {
  position: absolute;
  top: 8px;
  bottom: 8px;
  background: var(--tabs__highlight-background-color);
  box-shadow: var(--tabs__highlight-box-shadow);
  width: 170px;
  border-radius: 999px;
  transition: left 250ms ease-in-out, width 250ms ease-in-out;
}

.tab-window {
  position: relative;
  overflow: hidden;
  transition: all 50ms;
}

.tab-bodies {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  position: relative;
  transition: all 300ms;
}

.window-shade-left {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 2;
  width: 30px;
  background: linear-gradient(90deg, var(--block__background-color) 0%, rgba(0, 0, 0, 0) 50%);
}

.window-shade-right {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  z-index: 2;
  width: 30px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0) 50%, var(--block__background-color) 100%);
}

</style>
