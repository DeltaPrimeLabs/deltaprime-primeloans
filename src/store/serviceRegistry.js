import AssetBalancesExternalUpdateService from '../services/assetBalancesExternalUpdateService';
import TotalStakedExternalUpdateService from '../services/totalStakedExternalUpdateService';
import DataRefreshEventService from '../services/dataRefreshEventService';

export default {
  namespaced: true,
  state: {
    assetBalancesExternalUpdateService: new AssetBalancesExternalUpdateService(),
    totalStakedExternalUpdateService: new TotalStakedExternalUpdateService(),
    dataRefreshEventService: new DataRefreshEventService(),
  },
  mutations: {
  },
  actions: {
  },
};
