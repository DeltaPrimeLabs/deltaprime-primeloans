import Vue from 'vue';
import Vuex from 'vuex';

import network from './network';
import fundsStore from './fundsStore';
import poolStore from './poolStore';
import stakeStore from './stakeStore';
import serviceRegistry from './serviceRegistry';
import notifiStore from './notifiStore';

Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    network,
    fundsStore,
    poolStore,
    stakeStore,
    serviceRegistry,
    notifiStore
  },
});
