import Vue from 'vue';
import Vuex from 'vuex';

import network from './network';
import pool from './pool';
import loan from './loan';
import prices from './prices';
import nft from './nft';

Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    network,
    pool,
    loan,
    prices,
    nft
  },
});
