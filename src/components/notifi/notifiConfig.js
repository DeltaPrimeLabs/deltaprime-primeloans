export default {
  SCREENS_CONFIG: {
    login: { // user registration to notifi screen
      componentName: "Login",
      title: "Connect to Notifi",
      topInfo: "It’s been a while! Connect to Notifi to load your notification details.",
      customStyles: {
        button: {
          fontSize: "14px",
          padding: "9px 16px"
        }
      }
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
      customStyles: {
        button: {
          fontSize: "14px",
          padding: "9px 16px"
        }
      }
    }
  },
  ALERTS_CONFIG: [
    {
      id: "announcements",
      label: "DeltaPrime Announcements",
      toggle: true
    },
    {
      id: "liquidation",
      label: "Liquidation Alerts",
      tooltip: "Liquidation Alerts",
      toggle: true
    },
    {
      id: "loanHealth",
      label: "Loan Health Alerts",
      tooltip: "Loan Health Alerts",
      toggle: true,
      settingsNote: "Alert me when my loan health score goes below LTV threshold"
    },
    {
      id: "interestRate",
      label: "Borrowing Interest Rate Alerts",
      tooltip: "Borrowing Interest Rate Alerts"
    }
  ],
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
    "$USDC Borrowing Interest Rate Alert": {
      iconSrc: "src/assets/icons/icon_rate.svg"
    },
    "$USDC Deposit Interest Rate Alert": {
      iconSrc: "src/assets/icons/icon_rate.svg"
    }
  },
  HEALTH_RATES_CONFIG: [
    {
      id: "sixty",
      value: 60
    },
    {
      id: "seventy",
      value: 70
    }
  ]
}