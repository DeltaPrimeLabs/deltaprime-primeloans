import Vue from 'vue'
import Router from 'vue-router'
import Pool from '@/pages/Pool'
import Loan from '@/pages/Loan'
import Admin from '@/pages/Admin'
import Mint from "@/pages/Mint";


Vue.use(Router)


export default new Router({
  routes: [
    {
      path: '/pool',
      name: 'Pool',
      component: Pool
    },
    {
      path: '/loan',
      name: 'Loan',
      component: Loan
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
