/**
 * Copy this file to firebase-config.js and fill in your values.
 * firebase-config.js is gitignored.
 *
 * From Ionic: use the same object as `environment.firebase` from
 * `src/environments/environment.ts` as __TRAVACEBU_FIREBASE_CONFIG__ (flat keys).
 * Put `googleMapsApiKey` + `openRouteServiceApiKey` in __TRAVACEBU_KEYS__.
 */
window.__TRAVACEBU_FIREBASE_CONFIG__ = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:xxxxxxxx',
};

/** Used by Places photo URLs + optional `key` on Render proxy (`places.js`). ORS routing in route editor. */
window.__TRAVACEBU_KEYS__ = {
  googleMapsApiKey: '',
  openRouteServiceApiKey: '',
};
