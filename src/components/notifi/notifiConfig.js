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
    primeAccount: {
      "announcement": {
        type: "announcement",
        label: "DeltaPrime Announcements",
        toggle: true,
        createMethod: "createAnnouncements"
      },
      "liquidation": {
        type: "liquidation",
        label: "Liquidation Alerts",
        tooltip: "Liquidation Alerts",
        toggle: true,
        createMethod: "createLiquidationAlerts"
      },
      "loanHealth": {
        type: "loanHealth",
        label: "Loan Health Alerts",
        tooltip: "Loan Health Alerts",
        toggle: true,
        createMethod: "createLoanHealthAlerts",
        thresholdOptions: true,
        settingsNote: "Alert me when my health goes below this threshold"
      },
      "borrowRate": {
        type: "borrowRate",
        label: "Borrowing Interest Rate Alerts",
        tooltip: "Borrowing Interest Rate Alerts",
        createMethod: "createBorrowRateAlerts"
      }
    },
    pools: {
      "announcement": {
        type: "announcement",
        label: "DeltaPrime Announcements",
        toggle: true,
        createMethod: "createAnnouncements"
      },
      "lendingRate": {
        type: "lendingRate",
        label: "Lending Interest Rate Alerts",
        tooltip: "Lending Interest Rate Alerts",
        createMethod: "createLendingRateAlerts"
      }
    }
  },
  NOTIFICATION_ICONS_CONFIG: {
    "Announcement": {
      LIGHT: "src/assets/icons/icon_announcement.svg",
      DARK: "src/assets/icons/icon_announcement_dark.svg"
    },
    "Liquidation Alert": {
      LIGHT: "src/assets/icons/icon_liquidation.svg",
      DARK: "src/assets/icons/icon_liquidation_dark.svg"
    },
    "Loan Health Alert": {
      LIGHT: "src/assets/icons/icon_health.svg",
      DARK: "src/assets/icons/icon_health_dark.svg"
    },
    "Borrow Rate Alert": {
      LIGHT: "src/assets/icons/icon_rate.svg",
      DARK: "src/assets/icons/icon_rate_dark.svg"
    },
    "Deposit Rate Alert": {
      LIGHT: "src/assets/icons/icon_rate.svg",
      DARK: "src/assets/icons/icon_rate_dark.svg"
    }
  },
  HEALTH_RATES_CONFIG: [
    {
      id: "first",
      value: 10
    },
    {//default
      id: "second",
      value: 20,
    },
    {
      id: "custom",
      value: null,
    }
  ],
}