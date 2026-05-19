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
          <span class="tc-theme-toggle__icon" aria-hidden="true">&#9788;</span>
        }
        @case ('dark') {
          <span class="tc-theme-toggle__icon" aria-hidden="true">&#9790;</span>
        }
        @default {
          <span class="tc-theme-toggle__icon" aria-hidden="true">&#9654;</span>
        }
      }
    </button>
  `,
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
}
