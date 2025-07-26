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
      'https://maps.google.com/*',
      'https://server.arcgisonline.com',
      'https://server.arcgisonline.com/*',
      'https://*.tile.openstreetmap.org',
      'https://*.tile.openstreetmap.org/*',
      'https://router.project-osrm.org',
      'https://router.project-osrm.org/*',
      'https://api.openrouteservice.org',
      'https://api.openrouteservice.org/*'
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
