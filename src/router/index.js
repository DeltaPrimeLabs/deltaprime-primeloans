import Vue from 'vue'
import Router from 'vue-router'
import Nft from "@/pages/Nft";
import BorrowNft from "@/components/BorrowNft";
import DepositNft from "@/components/DepositNft";
import PrimeAccount from '../pages/PrimeAccount';
import PoolsBeta from '../components/PoolsBeta';


Vue.use(Router)


export default new Router({
  routes: [
    {
      path: '/pool-beta',
      name: 'Pools Beta',
      component: PoolsBeta
    },
    {
      path: '/prime-account',
      name: 'Prime Account',
      component: PrimeAccount,
      children: [
        {
          name: 'Prime Account Assets',
          path: 'assets'
        },
        {
          name: 'Prime Account Farms',
          path: 'farms'
        },
      ]
    },
    {
      path: '/nft',
      name: 'Nft',
      component: Nft,
      children: [
        {
          path: 'list',
          component: BorrowNft
        },
        {
          path: 'deposit',
          component: DepositNft
        },
      ],
    },
    {
      path: '*',
      redirect: { name: 'Prime Account Assets' }
    },
  ]
})
