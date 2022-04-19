<template>
  <div>
    {{nfts.length}}
    <Mint v-if="showMintBox" :hasNft="hasEapNft" :nftContract="eapNftContract" :mintNFT="mintBorrowNft" :nftImageUri="borrowNftImageUri" :getNftId="getBorrowNftId"/>
    <NftList :nfts="nfts"></NftList>
  </div>
</template>

<script>
import Mint from "../components/Mint";
const ethers = require('ethers');
import {mapActions, mapState} from "vuex";

export default {
  name: 'BorrowNft',
  components: {
    Mint
  },
  computed: {
    ...mapState('network', ['provider']),
    ...mapState('nft', ['eapNftContract', 'borrowNftImageUri', 'hasEapNft', 'nfts']),
  },
  methods: {
    ...mapActions('nft', ['getBorrowNftId', 'mintBorrowNft'])
  },
  data() {
    return {
      showMintBox: true
    }
  },
  mounted() {
    this.showMintBox = this.$route.query.signature
  },
}
</script>
