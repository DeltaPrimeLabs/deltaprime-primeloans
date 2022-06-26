import Vue from 'vue';
import Vuex from 'vuex';

import network from './network';
import pool from './pool';
import loan from './loan';
import nft from './nft';
import fundsStore from './fundsStore';

Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    network,
    pool,
    loan,
    nft,
    fundsStore
  },
});
