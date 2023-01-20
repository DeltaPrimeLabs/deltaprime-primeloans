import AssetBalancesExternalUpdateService from '../services/assetBalancesExternalUpdateService';
import TotalStakedExternalUpdateService from '../services/totalStakedExternalUpdateService';
import DataRefreshEventService from '../services/dataRefreshEventService';
import ProgressBarService from '../services/progressBarService';
import ModalService from '../services/modalService';
import HealthService from '../services/healthService';
import FarmService from "../services/farmService";
import LpService from "../services/lpService";

export default {
  namespaced: true,
  state: {
    assetBalancesExternalUpdateService: new AssetBalancesExternalUpdateService(),
    totalStakedExternalUpdateService: new TotalStakedExternalUpdateService(),
    dataRefreshEventService: new DataRefreshEventService(),
    progressBarService: new ProgressBarService(),
    modalService: new ModalService(),
    healthService: new HealthService(),
    farmService: new FarmService(),
    lpService: new LpService(),
  },
  mutations: {
  },
  actions: {
  },
};
