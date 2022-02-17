<template>
  <div class="mint container">
    <Block class="block" :bordered="true">
      <div class="title">{{ hasNft ? 'Your access NFT' : 'Mint your access NFT' }}</div>
      <div class="nft">
        <video muted autoplay loop :src="videoUri" />
      </div>
      <div class="description" v-html="description"></div>
      <Button :disabled="hasNft || waiting" label="Mint" v-on:click="mint"/>
    </Block>
  </div>
</template>

<script>
import Block from "../components/Block";
import Button from "../components/Button";
import {mapState} from "vuex";

const ethers = require('ethers');

export default {
  name: 'Nft',
  components: {
    Button,
    Block
  },
  props: {
    hasNft: {
      type: Boolean,
      default: false,
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
      noAvailableNfts: false,
      exampleNft: "",
      userNft: "",
      notMintedYetMessage: "Get your own unique NFT to participate in our trading competition!",
      mintedMessage: "Your unique access NFT is minted!",
      noNftsAnymoreMessage: "We are sorry, but you are a little late... All access NFTs are already minted. But you can still join our" +
          "<a href='https://discord.gg/57EdDsvhxK' target='_blank'>Discord channel</a> to not miss the next opportunity!",
      intervalId: null,
      waiting: true
    }
  },
  computed: {
    ...mapState('network', ['provider']),
    description() {
      if (this.hasNft) {
        return this.mintedMessage;
      } else if (this.noAvailableNfts) {
        return this.noNftsAnymoreMessage;
      } else {
        this.waiting = false;
        return this.notMintedYetMessage;
      }
    },
    videoUri() {
      return this.nftImageUri ? this.nftImageUri : this.parseArweaveAddress('bn88OSxK6mtLWjPTPZnDBsINwY-9L07rlRwcLHmWfOo');
    }
  },
  methods: {
    async mint() {
      if (!this.hasNft) {
        this.waiting = true;
        const query = this.$route.query;

        await this.handleTransaction(this.nftContract.safeMint, [query.id, query.signature],
            async () => {
              await this.getNftId();
              this.waiting = false;
            }
        );
      }
    }
  },
  watch: {
    nftContract: {
      handler(value) {
        if (value && !this.hasNft) {
          value.getAvailableUrisCount().then(
            count => {
              this.noAvailableNfts = count === 0;
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
