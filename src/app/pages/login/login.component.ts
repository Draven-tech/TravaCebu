import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { doc, getDoc } from 'firebase/firestore';
import { AdminAuthService, ADMIN_ACCESS_DENIED } from '../../services/admin-auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private readonly authSvc = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  goWelcome(): void {
    window.location.href = '/welcome';
  }

  email = '';
  password = '';
  errorMsg = '';
  submitting = false;
  configOk = true;
  pwType: 'password' | 'text' = 'password';

  ngOnInit(): void {
    this.stripCredentialsFromUrl();
    if (!environment.firebase.apiKey || environment.firebase.apiKey === 'YOUR_FIREBASE_API_KEY') {
      this.configOk = false;
      this.errorMsg =
        'Missing Firebase config. Copy src/environments/environment.example.ts to environment.ts and add your keys.';
      return;
    }
    void this.redirectIfAlreadyAdmin();
  }

  private stripCredentialsFromUrl(): void {
    try {
      if (!location.search) return;
      const q = new URLSearchParams(location.search);
      if (q.has('password') || q.has('email')) {
        history.replaceState(null, '', location.pathname + location.hash);
      }
    } catch {
      /* ignore */
    }
  }

  private async redirectIfAlreadyAdmin(): Promise<void> {
    await this.authSvc.auth.authStateReady();
    const u = this.authSvc.auth.currentUser;
    if (!u) return;
    const snap = await getDoc(doc(this.authSvc.db, 'admins', u.uid));
    if (snap.exists()) void this.followReturn();
  }

  togglePw(): void {
    this.pwType = this.pwType === 'password' ? 'text' : 'password';
  }

  async submit(): Promise<void> {
    this.errorMsg = '';
    this.submitting = true;
    try {
      await this.authSvc.adminSignIn(this.email.trim(), this.password);
      await this.followReturn();
    } catch (x: unknown) {
      this.errorMsg = this.loginFailMessage(x);
    } finally {
      this.submitting = false;
    }
  }

  private async followReturn(): Promise<void> {
    const ret = sessionStorage.getItem('tc_return');
    sessionStorage.removeItem('tc_return');
    const qp = this.route.snapshot.queryParamMap.get('returnUrl');
    const target = qp || ret;
    if (target && target.startsWith('/') && !target.startsWith('//')) {
      await this.router.navigateByUrl(target);
      return;
    }
    if (target) {
      try {
        const u = new URL(target);
        if (u.origin === location.origin) {
          await this.router.navigateByUrl(u.pathname + u.search + u.hash);
          return;
        }
      } catch {
        /* ignore */
      }
    }
    await this.router.navigateByUrl('/admin/dashboard');
  }

  private firebaseErrorCode(x: unknown): string {
    if (!x || typeof x !== 'object') return '';
    const o = x as { code?: string; errorInfo?: { code?: string } };
    if (typeof o.code === 'string') return o.code;
    if (typeof o.errorInfo?.code === 'string') return o.errorInfo.code;
    return '';
  }

  private loginFailMessage(x: unknown): string {
    if (x && typeof x === 'object' && (x as Error).message === ADMIN_ACCESS_DENIED) {
      return 'This account is not authorized for administrative access. If you require access, contact your system administrator.';
    }
    const c = this.firebaseErrorCode(x);
    const msg = x && typeof x === 'object' && 'message' in x ? String((x as Error).message) : '';
    const raw = `${msg} ${c}`;
    if (c === 'auth/invalid-email') return 'Please enter a valid email address.';
    if (
      c === 'auth/user-not-found' ||
      c === 'auth/wrong-password' ||
      c === 'auth/invalid-credential' ||
      c === 'auth/invalid-login-credentials'
    ) {
      return 'The email address or password entered is incorrect.';
    }
    if (/invalid-credential|wrong-password|invalid login credentials|invalid_email_or_password/i.test(raw)) {
      return 'The email address or password entered is incorrect.';
    }
    if (c === 'auth/too-many-requests') return 'Too many attempts. Please wait and try again.';
    if (c === 'auth/network-request-failed') return 'Network error. Check your connection.';
    if (c === 'auth/operation-not-allowed')
      return 'Email/password sign-in is disabled in Firebase Authentication for this project.';
    if (c === 'auth/unauthorized-domain')
      return 'This site domain is not allowed. Firebase Console: Authentication, Settings, Authorized domains (add your host, e.g. localhost).';
    if (c === 'permission-denied')
      return 'Firestore denied reading admins. Check security rules for logged-in users.';
    if (c === 'auth/user-disabled') return 'This account has been disabled.';
    if (c === 'auth/missing-email') return 'Please enter your email address.';
    return `Sign-in failed${c ? ` (${c})` : ''}${msg ? `. ${msg}` : '.'}`;
  }
}
