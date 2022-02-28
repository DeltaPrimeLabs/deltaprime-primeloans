<template>
  <Mint :hasNft="hasDepositNft" :nftContract="depositNftContract" :nftImageUri="depositNftImageUri" :getNftId="getDepositNftId"/>
</template>

<script>
import Mint from "../components/Mint";
const ethers = require('ethers');
import {mapActions, mapGetters, mapState} from "vuex";

export default {
  name: 'DepositNft',
  components: {
    Mint
  },
  computed: {
    ...mapState('network', ['provider']),
    ...mapState('nft', ['depositNftContract', 'depositNftImageUri', 'hasDepositNft'])
  },
  methods: {
    ...mapActions('nft', ['getDepositNftId'])
  }
}
</script>
