import Vue from 'vue'
import Router from 'vue-router'
import Pool from '@/pages/Pool'
import Admin from '@/pages/Admin'
import Mint from "@/pages/Mint";
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
      path: '/mint',
      name: 'Mint',
      component: Mint
    },
    {
      path: '*',
      redirect: { name: 'Pool' }
    },
  ]
})
