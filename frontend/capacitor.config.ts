import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.industrialcrm.app',
  appName: 'Industrial CRM',
  webDir: 'public',
  server: {
    androidScheme: 'https',
    // Point this at your deployed frontend URL (production) or your machine's
    // local IP for development testing, e.g. http://192.168.1.50:3000
    url: 'https://your-deployed-frontend-url.com',
    cleartext: true,
  },
  android: {
    buildOptions: {
      keystorePath: 'release.keystore',
      keystoreAlias: 'industrial-crm',
    },
    backgroundColor: '#0F172A',
  },
  plugins: {
    Geolocation: {
      permissions: ['location'],
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1E3A5F',
      showSpinner: false,
    },
  },
};

export default config;
