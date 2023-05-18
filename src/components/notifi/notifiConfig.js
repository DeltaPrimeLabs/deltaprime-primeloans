import WAVAX_POOL_TUP from '@contracts/WavaxPoolTUP.json';
import USDC_POOL_TUP from '@contracts/UsdcPoolTUP.json';
import USDT_POOL_TUP from '@contracts/UsdtPoolTUP.json';
import BTC_POOL_TUP from '@contracts/BtcPoolTUP.json';
import ETH_POOL_TUP from '@contracts/EthPoolTUP.json';

export default {
  customStyles: {
    button: {
      fontSize: "14px",
      padding: "9px 16px"
    }
  },
  SCREENS_CONFIG: {
    login: { // user registration to notifi screen
      componentName: "Login",
      title: "Connect to Notifi",
      topInfo: "It’s been a while! Connect to Notifi to load your notification details.",
    },
    notifications: { // main screen with notifications list
      componentName: "Notifications",
      title: "Notifications",
      settings: true
    },
    notificationDetail: { // notification detail screen
      componentName: "NotificationDetail",
      title: "Notification Details",
      backButton: true
    },
    settings: { // Manage notifications screen
      componentName: "Settings",
      title: "Manage Notifications",
      topInfo: "Get alerts to the destinations of your choice",
      backButton: true
    },
    targetSetup: { // Destinations setup screen
      componentName: "TargetSetup",
      title: "Get Notifications",
      topInfo: "Get alerts to the destinations of your choice",
    }
  },
  ALERTS_CONFIG: {
    "BROADCAST_MESSAGES": {
      type: "BROADCAST_MESSAGES",
      label: "DeltaPrime Announcements",
      toggle: true,
      createMethod: "createAnnouncements"
    },
    "LIQUIDATIONS": {
      type: "LIQUIDATIONS",
      label: "Liquidation Alerts",
      tooltip: "Liquidation Alerts",
      toggle: true,
      createMethod: "createLiquidationAlerts"
    },
    "DELTA_PRIME_LENDING_HEALTH_EVENTS": {
      type: "DELTA_PRIME_LENDING_HEALTH_EVENTS",
      label: "Loan Health Alerts",
      tooltip: "Loan Health Alerts",
      toggle: true,
      createMethod: "createLoanHealthAlerts",
      thresholdOptions: true,
      settingsNote: "Alert me when my loan health score goes below Health threshold"
    },
    "DELTA_PRIME_BORROW_RATE_EVENTS": {
      type: "DELTA_PRIME_BORROW_RATE_EVENTS",
      label: "Borrowing Interest Rate Alerts",
      tooltip: "Borrowing Interest Rate Alerts",
      createMethod: "createBorrowRateAlerts"
    }
  },
  NOTIFICATION_ICONS_CONFIG: {
    "Announcement": {
      iconSrc: "src/assets/icons/icon_announcement.svg"
    },
    "Liquidation": {
      iconSrc: "src/assets/icons/icon_liquidation.svg"
    },
    "Loan Health Alerts": {
      iconSrc: "src/assets/icons/icon_health.svg"
    },
    "Borrowing Interest Rate Alert": {
      iconSrc: "src/assets/icons/icon_rate.svg"
    },
    "Deposit Interest Rate Alert": {
      iconSrc: "src/assets/icons/icon_rate.svg"
    }
  },
  HEALTH_RATES_CONFIG: [
    {
      id: "sixty",
      value: 60
    },
    {//default
      id: "seventy",
      value: 70,
    },
    {
      id: "custom",
      value: null,
    }
  ],
  POOLS_CONFIG: [
    {
      name: "AVAX",
      address: WAVAX_POOL_TUP.address,
    },
    {
      name: "USDC",
      address: USDC_POOL_TUP.address,
    },
    {
      name: "USDT",
      address: USDT_POOL_TUP.address,
    },
    {
      name: "BTC",
      address: BTC_POOL_TUP.address,
    },
    {
      name: "ETH",
      address: ETH_POOL_TUP.address,
    }
  ]
}