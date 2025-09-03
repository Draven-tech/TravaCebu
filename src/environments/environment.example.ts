// This is an example environment file. Copy this to environment.ts and environment.prod.ts
// and replace the placeholder values with your actual API keys.

export const environment = {
  production: false, // Set to true for production
  firebase: {
    apiKey: "your-firebase-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
  },
  googleMapsApiKey: 'your-google-maps-api-key',
  openRouteServiceApiKey: 'your-openroute-service-api-key'
}; 