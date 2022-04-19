<template>
  <div id="NftList" class="nft-list">
    <div class="page-title">
      Your NFTs
    </div>

    <div class="nfts-grid">
      <div class="nft nft-video" v-for="nft in nfts">
        <video class="video" muted autoplay loop :src="nft"></video>
      </div>
      <div v-for="placeholder in numberOfPlaceholders" class="nft nft-placeholder"></div>
    </div>
  </div>
</template>

<script>


import SmallBlock from "./SmallBlock";

export const LG_BRAKEPOINT = 992;
export const SM_BRAKEPOINT = 576;

export default {
  name: 'NftList',
  components: {
    SmallBlock
  },
  props: {
    nfts: {
      default: []
    }
  },
  data() {
    return {
      numberOfPlaceholders: 3,
    }
  },
  computed: {
  },
  methods: {
    setupNumberOfPlaceholders() {
      let innerWidth = window.innerWidth;
      if (innerWidth > LG_BRAKEPOINT) {
        this.numberOfPlaceholders = (6 - this.nfts.length) % 3;
      } else if (innerWidth < LG_BRAKEPOINT && innerWidth > SM_BRAKEPOINT) {
        this.numberOfPlaceholders = (6 - this.nfts.length) % 2;
      } else {
        this.numberOfPlaceholders = 0;
      }
    }
  },
  watch: {
    nfts: {
      handler() {
        this.setupNumberOfPlaceholders();
      }
    }
  },
  mounted() {
    this.setupNumberOfPlaceholders();
  }
}
</script>
<style lang="scss" scoped>
@import "~@/styles/variables";

.nft-list {
  max-width: 970px;
  margin: auto;

  @media screen and (max-width: $lg) {
    padding: 0 20px;
  }
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  width: 100%;
  text-align: center;
  margin-bottom: 40px;
}

.nfts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  column-gap: 40px;
  row-gap: 40px;
  padding-bottom: 40px;

  @media screen and (max-width: $lg) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media screen and (max-width: $sm) {
    grid-template-columns: repeat(1, 1fr);
  }


  .nft {
    width: 100%;
    height: 450px;
    border-radius: 23px;
  }

  .video {
    width: 100%;
    height: 450px;
    object-fit: cover;
    border-radius: 23px;
  }

  .nft-placeholder {
    opacity: 0.08;
    background-image: linear-gradient(152deg, #7476fc 23%, #ff6f43 65%, #f5217f 96%);
  }
}
</style>
