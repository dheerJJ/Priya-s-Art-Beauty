import packageJson from '../../package.json'

// =========================================================
// BRANDING & CREATOR CREDIT CONFIGURATION
// Single source of truth for creator attribution and application metadata.
// Do not hardcode credit text anywhere else in the application.
// =========================================================

export const BRANDING_CONFIG = {
  // Attribution credit text
  creditText: 'Created by DWS Web Services',

  // Optional URL: If empty, renders as plain text. If set, renders as a secure external link.
  creditUrl: '',

  // Global toggle to display or hide the credit line across the application
  showCredit: true,

  // Application display name
  appName: "Priya's Art Beauty & Makeup Academy CRM",

  // Application version read directly from frontend package.json
  appVersion: packageJson.version || '1.0.0',
}

export default BRANDING_CONFIG
