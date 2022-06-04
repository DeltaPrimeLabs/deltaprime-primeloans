<template lang="html">
  <div class="tabs">
    <ul class='tabs-header'>
      <li v-for='(tab, index) in tabs'
        :key='tab.title'
        @click="selectedIndex = index"
        :class="{
          'tab-selected': (index === selectedIndex)}">
        <div class="tab-button">
          <div :style="{'width': tab.titleWidth}">{{ tab.title }}</div>
        </div>
        <img v-if="index !== tabs.length - 1" src="src/assets/icons/slash.svg" class="slash">
      </li>
    </ul>
    <slot></slot>
  </div>
</template>

<script>
export default {
  props: {
    mode: {
      type: String
    },
    openTabIndex: {
      type: Number,
      default: 0
    },
  },
  data () {
    return {
      selectedIndex: this.openTabIndex,
      tabs: []
    }
  },
  created () {
    this.tabs = this.$children
  },
  mounted () {
    this.selectTab(this.openTabIndex)
  },
  methods: {
    selectTab(i) {
      this.tabs.forEach((tab, index) => {
        tab.isActive = (index === i)
      });
    }
  },
  watch: {
    selectedIndex: function(value) {
      this.selectTab(value)
    },
    openTabIndex: function(value) {
      this.selectedIndex = value;
    },
  }
}
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

  ul.tabs-header {
    display: flex;
    list-style: none;
    margin: 0 0 20px 20px;
    padding: 0;
    justify-content: center;
    font-size: $font-size-md;

    @media screen and (min-width: $md) {
      font-size: $font-size-xxl;
    }
  }

  ul.tabs-header .tab-button {
    border-radius: 10px;
    margin: 0;
    margin-right: 5px;
    cursor: pointer;
    display: flex;
    align-items: center;

    @media screen and (min-width: $md) {
      padding: 15px;
    }
  }

  .tab-button {
    display: inline-block;
    color: #7d7d7d;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    border-radius: 10px;

    @media screen and (min-width: $md) {
      padding-left: 0px;
      padding-right: 20px;
    }
  }

  .tab-selected .tab-button {
    font-weight: bold;
    color: black;
  }

  li {
    display: flex;
  }

  li:not(.tab-selected):hover {
    .tab-button {
      color: black;
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
</style>
