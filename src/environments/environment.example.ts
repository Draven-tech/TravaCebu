/** Copy to `environment.ts` and fill in real values (that file is gitignored). */
export const environment = {
  production: false,
  firebase: {
    apiKey: 'YOUR_FIREBASE_API_KEY',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project-id',
    storageBucket: 'your-project.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:xxxxxxxxxxxxxxxx',
  },
  keys: {
    googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY',
    openRouteServiceApiKey: 'YOUR_OPENROUTESERVICE_API_KEY',
  },
};
