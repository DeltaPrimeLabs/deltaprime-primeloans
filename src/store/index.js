import Vue from 'vue';
import Vuex from 'vuex';

import network from './network';
import fundsStore from './fundsStore';
import poolStore from './poolStore';
import stakeStore from './stakeStore';
import sPrimeStore from './sPrimeStore';
import serviceRegistry from './serviceRegistry';

Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    network,
    fundsStore,
    poolStore,
    stakeStore,
    sPrimeStore,
    serviceRegistry
  },
});
