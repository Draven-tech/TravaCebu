import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'TravaCebu',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'https://maps.googleapis.com',
      'https://maps.googleapis.com/*',
      'https://maps.google.com',
      'https://maps.google.com/*'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: '#FFD144',
      showSpinner: true,
      spinnerColor: '#e74c3c'
    }
  }
};

export default config;
