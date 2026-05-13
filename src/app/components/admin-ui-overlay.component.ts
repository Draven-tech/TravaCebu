import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiService, type AdminOverlay } from '../services/admin-ui.service';

@Component({
  selector: 'app-admin-ui-overlay',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (overlay(); as o) {
      <div
        class="modal-back admin-ui-layer"
        [class.on]="true"
        role="presentation"
        (click)="onBackdrop(o)"
      >
        <div
          class="modal modal-confirm admin-ui-dialog"
          role="dialog"
          [attr.aria-labelledby]="'admin-ui-title'"
          [attr.aria-modal]="true"
          (click)="$event.stopPropagation()"
        >
          <h2 id="admin-ui-title" class="admin-ui-title">{{ o.title }}</h2>
          @switch (o.kind) {
            @case ('alert') {
              <p class="admin-ui-msg">{{ o.message }}</p>
              <div class="row" style="justify-content: flex-end; margin-top: 1rem">
                <button type="button" (click)="o.finish()">OK</button>
              </div>
            }
            @case ('confirm') {
              <p class="admin-ui-msg">{{ o.message }}</p>
              <div class="row" style="justify-content: flex-end; gap: 0.5rem; margin-top: 1rem">
                <button type="button" class="secondary" (click)="o.finish(false)">{{ o.cancelLabel }}</button>
                <button type="button" [class.danger]="o.danger" (click)="o.finish(true)">{{ o.okLabel }}</button>
              </div>
            }
            @case ('prompt') {
              <p class="admin-ui-msg">{{ o.message }}</p>
              @if (o.multiline) {
                <textarea
                  class="admin-ui-field"
                  rows="4"
                  [placeholder]="o.placeholder || ''"
                  [(ngModel)]="promptDraft"
                  name="adminPrompt"
                ></textarea>
              } @else {
                <input
                  class="admin-ui-field"
                  type="text"
                  [placeholder]="o.placeholder || ''"
                  [(ngModel)]="promptDraft"
                  name="adminPrompt"
                  (keydown.enter)="onPromptEnter(o, $event)"
                />
              }
              @if (promptError()) {
                <p class="error" style="margin-top: 0.5rem">{{ promptError() }}</p>
              }
              <div class="row" style="justify-content: flex-end; gap: 0.5rem; margin-top: 1rem">
                <button type="button" class="secondary" (click)="finishPrompt(o, null)">Cancel</button>
                <button type="button" (click)="finishPrompt(o, promptDraft)">OK</button>
              </div>
            }
            @case ('pickNumber') {
              @if (o.message) {
                <p class="admin-ui-msg">{{ o.message }}</p>
              }
              @if (o.detail) {
                <pre class="admin-ui-detail">{{ o.detail }}</pre>
              }
              <label class="admin-ui-pick-label">
                Number ({{ o.min }}–{{ o.max }})
                <input
                  class="admin-ui-field"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  [(ngModel)]="pickDraft"
                  name="adminPick"
                />
              </label>
              @if (pickError()) {
                <p class="error" style="margin-top: 0.5rem">{{ pickError() }}</p>
              }
              <div class="row" style="justify-content: flex-end; gap: 0.5rem; margin-top: 1rem">
                <button type="button" class="secondary" (click)="o.finish(null)">Cancel</button>
                <button type="button" (click)="finishPickNumber(o)">OK</button>
              </div>
            }
          }
        </div>
      </div>
    }
  `,
  styles: `
    .admin-ui-layer {
      z-index: 2000;
      background: rgba(15, 23, 42, 0.78);
      -webkit-backdrop-filter: blur(4px);
      backdrop-filter: blur(4px);
    }
    .admin-ui-dialog {
      max-width: min(92vw, 460px);
      padding: 1.5rem 1.65rem;
      background: #ffffff;
      color: #0f172a;
      color-scheme: light;
      border: 2px solid #94a3b8;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.08) inset,
        0 28px 70px rgba(0, 0, 0, 0.35);
    }
    .admin-ui-title {
      margin-top: 0;
      font-size: 1.35rem;
      font-weight: 800;
      line-height: 1.25;
      color: #020617;
    }
    .admin-ui-msg {
      margin-bottom: 0.75rem;
      white-space: pre-wrap;
      color: #0f172a;
      font-size: 1rem;
      font-weight: 500;
      line-height: 1.6;
    }
    .admin-ui-detail {
      max-height: 200px;
      overflow: auto;
      margin: 0 0 0.75rem;
      padding: 0.5rem 0.75rem;
      background: #f1f5f9;
      border-radius: 8px;
      font-size: 0.8rem;
      line-height: 1.35;
      white-space: pre-wrap;
    }
    .admin-ui-field {
      width: 100%;
      margin-top: 0.35rem;
      padding: 0.45rem 0.6rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font: inherit;
      box-sizing: border-box;
    }
    .admin-ui-pick-label {
      display: block;
      margin-top: 0.5rem;
      font-size: 0.9rem;
      color: #334155;
      font-weight: 600;
    }
  `,
})
export class AdminUiOverlayComponent {
  private readonly adminUi = inject(AdminUiService);
  readonly overlay = this.adminUi.overlay;

  promptDraft = '';
  pickDraft = '';
  readonly promptError = signal('');
  readonly pickError = signal('');

  constructor() {
    effect(() => {
      const o = this.adminUi.overlay();
      this.promptError.set('');
      this.pickError.set('');
      if (o?.kind === 'prompt') {
        this.promptDraft = o.initialValue;
      }
      if (o?.kind === 'pickNumber') {
        this.pickDraft = String(o.initialValue);
      }
    });
  }

  onBackdrop(o: AdminOverlay): void {
    if (o.kind === 'alert') {
      o.finish();
      return;
    }
    if (o.kind === 'confirm') {
      o.finish(false);
      return;
    }
    if (o.kind === 'prompt') {
      o.finish(null);
      return;
    }
    o.finish(null);
  }

  finishPrompt(o: Extract<AdminOverlay, { kind: 'prompt' }>, value: string | null): void {
    if (value === null) {
      o.finish(null);
      return;
    }
    const t = value.trim();
    if (o.required && !t) {
      this.promptError.set('This field is required.');
      return;
    }
    o.finish(t);
  }

  onPromptEnter(o: Extract<AdminOverlay, { kind: 'prompt' }>, ev: Event): void {
    const ke = ev as KeyboardEvent;
    if (o.multiline) return;
    ke.preventDefault();
    this.finishPrompt(o, this.promptDraft);
  }

  finishPickNumber(o: Extract<AdminOverlay, { kind: 'pickNumber' }>): void {
    const n = parseInt(String(this.pickDraft).trim(), 10);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < o.min || n > o.max) {
      this.pickError.set(`Enter a whole number from ${o.min} to ${o.max}.`);
      return;
    }
    o.finish(n);
  }
}
