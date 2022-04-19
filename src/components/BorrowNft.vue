<template>
  <div>
    <Mint v-if="showMintBox" :hasNft="hasBorrowNft" :nftContract="borrowNftContract" :mintNFT="mintBorrowNft" :nftImageUri="borrowNftImageUri" :getNftId="getBorrowNftId"/>
    <NftList :nfts="nfts"></NftList>
  </div>
</template>

<script>
import Mint from "../components/Mint";
import NftList from "../components/NftList";

const ethers = require('ethers');
import {mapActions, mapState} from "vuex";

export default {
  name: 'BorrowNft',
  components: {
    Mint,
    NftList
  },
  computed: {
    ...mapState('network', ['provider']),
    ...mapState('nft', ['borrowNftContract', 'borrowNftImageUri', 'hasBorrowNft']),
  },
  methods: {
    ...mapActions('nft', ['getBorrowNftId', 'mintBorrowNft'])
  },
  data() {
    return {
      showMintBox: true,
      nfts : [
        {
          url: 'https://arweave.net/Ga5-ypvTdKRG2YUYIxWjVDlgSzJgWgbeMIoge6kpeOs'
        },
        {
          url: 'https://arweave.net/Ga5-ypvTdKRG2YUYIxWjVDlgSzJgWgbeMIoge6kpeOs'
        },
        {
          url: 'https://arweave.net/Ga5-ypvTdKRG2YUYIxWjVDlgSzJgWgbeMIoge6kpeOs'
        },
        {
          url: 'https://arweave.net/Ga5-ypvTdKRG2YUYIxWjVDlgSzJgWgbeMIoge6kpeOs'
        },
        {
          url: 'https://arweave.net/Ga5-ypvTdKRG2YUYIxWjVDlgSzJgWgbeMIoge6kpeOs'
        },
      ]
    }
  },
  mounted() {
    this.showMintBox = this.$route.query.signature
  }
}
</script>
