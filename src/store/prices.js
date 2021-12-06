import redstone from 'redstone-api';

export default {
  namespaced: true,
  state: {
    avaxPrice: 0
  },
  mutations: {
    setAvaxPrice(state, price) {
      state.avaxPrice = price;
    }
  },
  getters: {
  },
  actions: {
    async initPrices({ dispatch }) {
      Promise.all([
        dispatch('updateAvaxPrice')
      ])
    },
    async updateAvaxPrice({ commit }) {
      const avaxPrice = (await redstone.getPrice("AVAX")).value;
        commit('setAvaxPrice', avaxPrice);
    }
  }
}
