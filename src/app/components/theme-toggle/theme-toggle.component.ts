import { Component, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="tc-theme-toggle"
      (click)="theme.cycle()"
      [attr.title]="theme.cycleHint()"
      [attr.aria-label]="theme.cycleHint()"
    >
      @switch (theme.mode()) {
        @case ('light') {
          <span class="tc-theme-toggle__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </span>
        }
        @case ('dark') {
          <span class="tc-theme-toggle__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </span>
        }
        @default {
          <span class="tc-theme-toggle__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
              <path d="M7 8h2M12 8h2M17 8h2" stroke-linecap="round" />
            </svg>
          </span>
        }
      }
    </button>
  `,
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
}
