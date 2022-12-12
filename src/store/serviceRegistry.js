import AssetBalancesExternalUpdateService from '../services/assetBalancesExternalUpdateService';
import TotalStakedExternalUpdateService from '../services/totalStakedExternalUpdateService';

export default {
  namespaced: true,
  state: {
    assetBalancesExternalUpdateService: new AssetBalancesExternalUpdateService(),
    totalStakedExternalUpdateService: new TotalStakedExternalUpdateService(),
  },
  mutations: {
  },
  actions: {
  },
};
