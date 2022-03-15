<template>
  <div class="mint container">
    <Block class="block" :bordered="true">
      <div class="title">{{ hasNft ? 'Your access NFT' : 'Mint your access NFT' }}</div>
      <div class="nft">
        <video muted autoplay loop :src="videoUri" />
      </div>
      <div class="description">
        <div v-html="description" v-if="description"></div>
        <vue-loaders-ball-beat v-else color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
      </div>
      <Button :disabled="hasNft || waiting || noAvailableNfts" label="Mint" v-on:click="mint"/>
    </Block>
  </div>
</template>

<script>
import Block from "../components/Block";
import Button from "../components/Button";
import {mapState} from "vuex";
import Vue from "vue";

const ethers = require('ethers');

export default {
  name: 'Nft',
  components: {
    Button,
    Block
  },
  props: {
    hasNft: {
      type: Boolean
    },
    nftImageUri: {
      type: String,
      default: null
    },
    nftContract: {
      default: null
    },
    getNftId: {
      type: Function,
      default: null
    }
  },
  data() {
    return {
      noAvailableNfts: null,
      exampleNft: "",
      userNft: "",
      notMintedYetMessage: "Get your own unique NFT to participate in our trading competition!",
      mintedMessage: "Your unique access NFT is minted! Go to <a href='/#/prime-account'>Prime Account</a> to start trading.",
      noNftsAnymoreMessage: "We are sorry, but you are a little late... All access NFTs are already minted.<br/> But you can still join our " +
          "<a href='https://discord.gg/57EdDsvhxK' target='_blank'>Discord server</a> not to miss the next opportunity!",
      intervalId: null,
      waiting: true
    }
  },
  computed: {
    ...mapState('network', ['provider']),
    description() {
      if (this.hasNft === true) {
        return this.mintedMessage;
      }

      if (this.noAvailableNfts === null) {
        return;
      }
      if (this.noAvailableNfts) {
        return this.noNftsAnymoreMessage;
      }

      if (this.hasNft === false) {
        this.waiting = false;
        return this.notMintedYetMessage;
      }
    },
    videoUri() {
      return this.nftImageUri ? this.nftImageUri : 'https://arweave.net/D4S3C6_cfvid7uRduzs95OhBw0jbruxnnljXX4P54yw';
    }
  },
  methods: {
    async mint() {
      if (!this.hasNft) {
        this.waiting = true;
        const query = this.$route.query;

        await this.handleTransaction(this.nftContract.safeMint, [query.id, query.signature],
            async () => {
              Vue.$toast.success('Minting successful! The NFT will soon show up on the page. If not refresh it after few seconds', { timeout: 3000 });
              await this.getNftId();
            },
            async () => {
              Vue.$toast.error('Minting failed. Check Metamask for more info');
            }
        );
      }
    }
  },
  watch: {
    nftContract: {
      handler(value) {
        if (value) {
          value.getAvailableUrisCount().then(
            count => {
              this.noAvailableNfts = count.toNumber() === 0;
            }
          )
          .catch(er => console.log(er));
        }
      },
      immediate: true
    }
  }
}
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.title {
  margin-bottom: 30px;
}

.description {
  text-align: center;
  margin-bottom: 30px;
  margin-top: 30px;
}

.nft {
  height: 300px;
  border-radius: 15px;
  overflow: hidden;

  video {
    height: 100%;
  }
}

</style>
<style lang="scss">
.mint {
  .nft {
    .vue-loaders {
      margin-top: 100%;
    }
  }

  .description {
    a {
      text-decoration: none;
      color: black;
      font-weight: 600;
    }
  }
}
</style>
