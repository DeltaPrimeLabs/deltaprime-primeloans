<template>
  <div class="invest container">
    <div v-if="isLoanAlreadyCreated === false">
      <Bar>
        <Value label="Available in pool"
          :primary="{value: getAvailable, type: 'avax', showIcon: true}"
          :secondary="{value: avaxToUSD(getAvailable), type: 'usd'}" />
        <Value label="Current APY" :primary="{value: borrowingRate, type: 'percent'}" />
      </Bar>
      <InfoBubble
        :text="bubbleText" />
      <Block class="block" :bordered="true">
        <InitLoanForm />
      </Block>
    </div>
    <SmartLoan v-if="isLoanAlreadyCreated === true"/>
    <vue-loaders-ball-beat v-if="isLoanAlreadyCreated === null" color="#A6A3FF" scale="2" class="loader"></vue-loaders-ball-beat>
  </div>
</template>


<script>
  import { mapState, mapGetters } from 'vuex';
  import InitLoanForm from "@/components/InitLoanForm.vue";
  import SmartLoan from "@/components/SmartLoan.vue";
  import Bar from "@/components/Bar.vue";
  import Block from "@/components/Block.vue";
  import Value from "@/components/Value.vue";
  import InfoBubble from "../components/InfoBubble";
  import config from "@/config";

  export default {
    name: 'Invest',
    components: {
      InfoBubble,
      InitLoanForm,
      SmartLoan,
      Bar,
      Block,
      Value
    },
    data() {
      return {
        bubbleText: `Create a loan to start your investment adventure. <br/>
        Remember that initial LTC cannot exceed <b>${config.DEFAULT_LTV * 100}%</b>.`
      }
    },
    computed: {
      ...mapState('loan', ['isLoanAlreadyCreated']),
      ...mapState('pool', ['borrowingRate']),
      ...mapGetters('pool', ['getAvailable'])
    },
    methods: {
    }
  }
</script>

<style lang="scss" scoped>
.block {
  margin-top: 30px;
}

.bars {
  display: flex;
  justify-content: space-between;
}

.bars > * {
  width: 47.5%;
}

.loader {
  margin-top: 30%;
}

.invest {
  text-align: center;
}
</style>

