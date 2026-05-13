import { Injectable, signal } from '@angular/core';

export type AdminOverlay =
  | {
      kind: 'alert';
      title: string;
      message: string;
      finish: () => void;
    }
  | {
      kind: 'confirm';
      title: string;
      message: string;
      okLabel: string;
      cancelLabel: string;
      danger: boolean;
      finish: (result: boolean) => void;
    }
  | {
      kind: 'prompt';
      title: string;
      message: string;
      placeholder?: string;
      initialValue: string;
      multiline: boolean;
      required: boolean;
      finish: (result: string | null) => void;
    }
  | {
      kind: 'pickNumber';
      title: string;
      message?: string;
      detail?: string;
      min: number;
      max: number;
      initialValue: number;
      finish: (result: number | null) => void;
    };

@Injectable({ providedIn: 'root' })
export class AdminUiService {
  private readonly _overlay = signal<AdminOverlay | null>(null);
  readonly overlay = this._overlay.asReadonly();

  alert(message: string, title = 'Notice'): Promise<void> {
    return new Promise((resolve) => {
      this._overlay.set({
        kind: 'alert',
        title,
        message,
        finish: () => {
          this._overlay.set(null);
          resolve();
        },
      });
    });
  }

  confirm(
    message: string,
    options?: { title?: string; okLabel?: string; cancelLabel?: string; danger?: boolean },
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this._overlay.set({
        kind: 'confirm',
        title: options?.title ?? 'Confirm',
        message,
        okLabel: options?.okLabel ?? 'OK',
        cancelLabel: options?.cancelLabel ?? 'Cancel',
        danger: options?.danger ?? false,
        finish: (v) => {
          this._overlay.set(null);
          resolve(v);
        },
      });
    });
  }

  prompt(options: {
    message: string;
    title?: string;
    placeholder?: string;
    defaultValue?: string;
    multiline?: boolean;
    required?: boolean;
  }): Promise<string | null> {
    return new Promise((resolve) => {
      this._overlay.set({
        kind: 'prompt',
        title: options.title ?? 'Input',
        message: options.message,
        placeholder: options.placeholder,
        initialValue: options.defaultValue ?? '',
        multiline: options.multiline ?? false,
        required: options.required ?? false,
        finish: (v) => {
          this._overlay.set(null);
          resolve(v);
        },
      });
    });
  }

  pickNumber(options: {
    title?: string;
    message?: string;
    detail?: string;
    min: number;
    max: number;
    defaultValue?: number;
  }): Promise<number | null> {
    const { min, max } = options;
    const initial = Math.min(max, Math.max(min, options.defaultValue ?? min));
    return new Promise((resolve) => {
      this._overlay.set({
        kind: 'pickNumber',
        title: options.title ?? 'Choose',
        message: options.message,
        detail: options.detail,
        min,
        max,
        initialValue: initial,
        finish: (v) => {
          this._overlay.set(null);
          resolve(v);
        },
      });
    });
  }
}
