import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { fixLeafletDefaultIcons } from './app/leaflet-defaults';

fixLeafletDefaultIcons();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
