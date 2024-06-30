import Vue from 'vue'
import Router from 'vue-router'
import PrimeAccount from '../pages/PrimeAccount';
import PoolsBeta from '../components/PoolsBeta';
import ProtocolStats from '../components/ProtocolStats';
import ClaimPrime from "../components/ClaimPrime.vue";


Vue.use(Router)


export default new Router({
  routes: [
    {
      path: '/pools',
      name: 'Pools',
      component: PoolsBeta
    },
    {
      path: '/claim',
      name: 'Claim',
      component: ClaimPrime
    },
    {
      path: '/prime-account',
      name: 'Prime Account',
      component: PrimeAccount,
      children: [
        {
          name: 'Prime Account Zaps',
          path: 'zaps'
        },
        {
          name: 'Prime Account Assets',
          path: 'assets'
        },
        {
          name: 'Prime Account Farms',
          path: 'farms'
        },
        {
          name: 'Prime Account LP',
          path: 'lp'
        },
        {
          name: 'Prime Account Stats',
          path: 'stats'
        },
      ]
    },
    {
      path: '/protocol',
      name: 'Protocol',
      component: ProtocolStats
    },
    {
      path: '*',
      redirect: { name: 'Prime Account Assets' }
    },
  ]
})
