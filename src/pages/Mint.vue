<template>
  <div class="mint container">
    <Block class="block" :bordered="true">
      <div class="title">{{ hasBorrowNft ? 'Your access NFT' : 'Mint your access NFT' }}</div>
      <div class="picture">
        <img v-if="borrowNftImageUri && hasBorrowNft" :src="borrowNftImageUri" alt="nft example picture"/>
        <img v-if="!hasBorrowNft && exampleNft" :src="exampleNft" alt="nft picture"/>
        <vue-loaders-ball-beat v-if="!(borrowNftImageUri || exampleNft)" color="#A6A3FF" scale="0.9"></vue-loaders-ball-beat>
      </div>
      <div class="description" v-html="description"></div>
      <Button :disabled="hasBorrowNft" label="Mint" v-on:click="mint"/>
    </Block>
  </div>
</template>

<script>
import Block from "../components/Block";
import Button from "../components/Button";
const ethers = require('ethers');
import {mapActions, mapGetters, mapState} from "vuex";

export default {
  name: 'Mint',
  components: {
    Button,
    Block
  },
  data() {
    return {
      images: null,
      exampleNft: "",
      userNft: "",
      notMintedYetMessage: "Get your own unique NFT to participate in our trading competition!",
      mintedMessage: "Your unique access NFT is minted! Follow our <a href='https://discord.gg/57EdDsvhxK' " +
          "target='_blank'>Discord channel</a> " +
      "for more info about the event!",
      noNftsAnymore: "We are sorry, but you are a little late... All access NFTs are already minted. But you can still join our" +
          "<a href='https://discord.gg/57EdDsvhxK' target='_blank'>Discord channel</a> to not miss the next opportunity!",
      intervalId: null
    }
  },
  computed: {
    ...mapState('network', ['provider']),
    ...mapState('nft', ['borrowNftContract', 'borrowNftImageUri']),
    ...mapGetters('nft', ['hasBorrowNft']),
    description() {
      if (this.hasBorrowNft) {
        return this.mintedMessage;
      } else if (this.images && this.images.length === 0) {
        return this.noNftsAnymore;
      } else {
        return this.notMintedYetMessage;
      }
    }
  },
  methods: {
    ...mapActions('nft', ['updateBorrowNftFromId', 'getBorrowNftId']),
    async mint() {
      if (!this.hasBorrowNft) {
        const query = this.$route.query;

        await this.handleTransaction(this.borrowNftContract.safeMint, [query.id, query.signature],
            async () => {
              await this.getBorrowNftId();
              clearInterval(this.intervalId);
            }
        );
      }
    }
  },
  watch: {
    borrowNftContract: {
      handler(value) {
        if (value && !this.hasBorrowNft) {
          value.getAvailableUris().then(
            res => {
              if (res.length > 10) {
                res = res.slice(0, 10);
              }

              let jsonPromises = res.map(
                  address => fetch(this.parseArweaveAddress(address))
              );

              Promise.all(jsonPromises).then(
                resps => {
                  Promise.all(resps.map(response => response.json())).then(
                      jsons => {
                        this.images =
                            jsons.map(json => this.parseArweaveAddress(json.image))

                        this.intervalId = setInterval(() => {
                          this.exampleNft = this.images[Math.floor(Math.random() * this.images.length)];
                        }, 500);
                      }
                  )
                }
              )
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

.picture {
  height: 200px;

  img {
    border-radius: 15px;
    height: 100%;
  }
}

</style>
<style lang="scss">
.mint {
  .picture {
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
