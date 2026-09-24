import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => {
    // Logger pas encore disponible, utiliser console.error seulement en local
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.error(err);
    }
  });
