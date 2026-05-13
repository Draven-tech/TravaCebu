import { Injectable, computed, signal, DestroyRef, inject } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'travacebu-admin-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<ThemeMode>(this.readStored());

  readonly cycleHint = computed(() => {
    switch (this.mode()) {
      case 'light':
        return 'Light theme. Click for dark.';
      case 'dark':
        return 'Dark theme. Click to match device.';
      default:
        return 'Theme matches device. Click for light.';
    }
  });

  constructor() {
    this.apply(this.mode());
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onOsChange = () => {
      if (this.mode() === 'system') {
        this.apply('system');
      }
    };
    mql.addEventListener('change', onOsChange);
    this.destroyRef.onDestroy(() => mql.removeEventListener('change', onOsChange));
  }

  cycle(): void {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    const cur = this.mode();
    const idx = order.indexOf(cur);
    const next = order[(idx + 1) % order.length];
    this.setMode(next);
  }

  setMode(next: ThemeMode): void {
    this.mode.set(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode etc. */
    }
    this.apply(next);
  }

  private readStored(): ThemeMode {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') {
        return v;
      }
    } catch {
      /* */
    }
    return 'system';
  }

  private apply(m: ThemeMode): void {
    document.documentElement.setAttribute('data-tc-theme', m);
    const dark =
      m === 'dark' || (m === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }
}
