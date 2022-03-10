<template>
  <div>
    <Mint :hasNft="hasBorrowNft" :nftContract="borrowNftContract" :nftImageUri="borrowNftImageUri" :getNftId="getBorrowNftId"/>
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
    ...mapState('nft', ['borrowNftContract', 'borrowNftImageUri', 'hasBorrowNft']),
  },
  methods: {
    ...mapActions('nft', ['getBorrowNftId'])
  }
}
</script>
