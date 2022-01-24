<template>
  <div class="pool container">
    <Block class="block" :bordered="true">
      <div class="title">Mint your access NFT</div>
      <div class="description">Only the owners of this NFT drop will be able to participate in DeltaPrime alpha trading competition</div>
      <Button label="Mint" v-on:click="mint"/>
    </Block>
  </div>
</template>

<script>
import Block from "../components/Block";
import Button from "../components/Button";
import BorrowAccessNFT from '@contracts/BorrowAccessNFT.json';
const ethers = require('ethers');
import config from "@/config";
import {mapState} from "vuex";
import Vue from "vue";

export default {
    name: 'Mint',
    components: {
      Button,
      Block
    },
    data() {
      return {
      }
    },
    computed: {
      ...mapState('network', ['provider']),
    },
    methods: {
      async mint() {
        console.log(BorrowAccessNFT)
        const nft = new ethers.Contract(BorrowAccessNFT.networks[config.chainId].address, BorrowAccessNFT.abi, provider.getSigner());
        const query = this.$route.query;

        let tokenId = await this.handleTransaction(nft.safeMint, [query.id, query.signature]);
        console.log(tokenId);
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
}

</style>
<style lang="scss">
</style>
