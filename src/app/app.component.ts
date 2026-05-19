import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminUiOverlayComponent } from './components/admin-ui-overlay.component';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AdminUiOverlayComponent],
  template: '<router-outlet /><app-admin-ui-overlay />',
  styleUrl: './app.component.css',
})
export class AppComponent {
  constructor() {
    inject(ThemeService);
  }
}
