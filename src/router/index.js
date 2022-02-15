import Vue from 'vue'
import Router from 'vue-router'
import Pool from '@/pages/Pool'
import Admin from '@/pages/Admin'
import Nft from "@/pages/Nft";
import BorrowNft from "@/components/BorrowNft";
import DepositNft from "@/components/DepositNft";
import PrimeAccount from "@/pages/PrimeAccount";


Vue.use(Router)


export default new Router({
  routes: [
    {
      path: '/pool',
      name: 'Pool',
      component: Pool
    },
    {
      path: '/prime-account',
      name: 'Prime Account',
      component: PrimeAccount
    },
    {
      path: '/admin',
      name: 'Admin',
      component: Admin
    },
    {
      path: '/nft',
      name: 'Nft',
      component: Nft,
      children: [
        {
          path: 'borrow',
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
      redirect: { name: 'Pool' }
    },
  ]
})
