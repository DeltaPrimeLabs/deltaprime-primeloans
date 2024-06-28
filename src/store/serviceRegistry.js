import AssetBalancesExternalUpdateService from '../services/assetBalancesExternalUpdateService';
import StakedExternalUpdateService from '../services/stakedExternalUpdateService';
import DataRefreshEventService from '../services/dataRefreshEventService';
import ProgressBarService from '../services/progressBarService';
import ModalService from '../services/modalService';
import HealthService from '../services/healthService';
import FarmService from "../services/farmService";
import LpService from "../services/lpService";
import AprService from '../services/aprService';
import ProviderService from '../services/providerService';
import AccountService from '../services/accountService';
import PoolService from "../services/poolService";
import PriceService from "../services/priceService";
import AssetDebtsExternalUpdateService from '../services/assetDebtsExternalUpdateService';
import CollateralService from '../services/collateralService';
import DebtService from '../services/debtService';
import ThemeService from "../services/themeService";
import StatsService from '../services/statsService';
import LoanHistoryService from "../services/loanHistoryService";
import WalletAssetBalancesService from '../services/walletAssetBalancesService';
import LifiService from '../services/lifiService';
import NotifiService from '../services/notifiService';
import TraderJoeService from '../services/traderJoeService';
import TermsService from '../services/termsService';
import DeprecatedAssetsService from '../services/deprecatedAssetsService';
import LtipService from "../services/ltipService";
import GgpIncentivesService from "../services/ggpIncentivesService";
import GlobalActionsDisableService from "../services/globalActionsDisableService";

export default {
  namespaced: true,
  state: {
    assetBalancesExternalUpdateService: new AssetBalancesExternalUpdateService(),
    assetDebtsExternalUpdateService: new AssetDebtsExternalUpdateService(),
    stakedExternalUpdateService: new StakedExternalUpdateService(),
    dataRefreshEventService: new DataRefreshEventService(),
    progressBarService: new ProgressBarService(),
    modalService: new ModalService(),
    healthService: new HealthService(),
    aprService: new AprService(),
    farmService: new FarmService(),
    lpService: new LpService(),
    providerService: new ProviderService(),
    accountService: new AccountService(),
    poolService: new PoolService(),
    priceService: new PriceService(),
    collateralService: new CollateralService(),
    debtService: new DebtService(),
    themeService: new ThemeService(),
    statsService: new StatsService(),
    loanHistoryService: new LoanHistoryService(),
    walletAssetBalancesService: new WalletAssetBalancesService(),
    lifiService: new LifiService(),
    notifiService: new NotifiService(),
    traderJoeService: new TraderJoeService(),
    termsService: new TermsService(),
    deprecatedAssetsService: new DeprecatedAssetsService(),
    ltipService: new LtipService(),
    ggpIncentivesService: new GgpIncentivesService(),
    globalActionsDisableService: new GlobalActionsDisableService(),
  },
};
