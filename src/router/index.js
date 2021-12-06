import Vue from 'vue'
import Router from 'vue-router'
import Pool from '@/pages/Pool'
import Loan from '@/pages/Loan'
import Admin from '@/pages/Admin'


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
      path: '*',
      redirect: { name: 'Pool' }
    },
  ]
})
