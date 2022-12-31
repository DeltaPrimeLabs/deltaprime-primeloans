import AssetBalancesExternalUpdateService from '../services/assetBalancesExternalUpdateService';
import TotalStakedExternalUpdateService from '../services/totalStakedExternalUpdateService';
import DataRefreshEventService from '../services/dataRefreshEventService';
import ProgressBarService from '../services/progressBarService';

export default {
  namespaced: true,
  state: {
    assetBalancesExternalUpdateService: new AssetBalancesExternalUpdateService(),
    totalStakedExternalUpdateService: new TotalStakedExternalUpdateService(),
    dataRefreshEventService: new DataRefreshEventService(),
    progressBarService: new ProgressBarService(),
  },
  mutations: {
  },
  actions: {
  },
};
