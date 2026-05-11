import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { environment } from '../../environments/environment';

export const ADMIN_ACCESS_DENIED = 'ADMIN_ACCESS_DENIED';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly app: FirebaseApp;
  private readonly router = inject(Router);

  constructor() {
    this.app = initializeApp(environment.firebase);
    const auth = getAuth(this.app);
    void setPersistence(auth, browserLocalPersistence).catch(() => {});
  }

  get auth() {
    return getAuth(this.app);
  }

  get db() {
    return getFirestore(this.app);
  }

  get storage() {
    return getStorage(this.app);
  }

  async adminSignIn(email: string, password: string) {
    const auth = this.auth;
    const cred = await signInWithEmailAndPassword(auth, email, password);
    try {
      const snap = await getDoc(doc(this.db, 'admins', cred.user.uid));
      if (!snap.exists()) {
        await firebaseSignOut(auth);
        throw new Error(ADMIN_ACCESS_DENIED);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message === ADMIN_ACCESS_DENIED) throw e;
      await firebaseSignOut(auth).catch(() => {});
      throw e;
    }
    return cred.user;
  }

  /** Returns true only when a user is signed in and has `admins/{uid}`. */
  async ensureAdmin(): Promise<boolean> {
    await this.auth.authStateReady();
    const u = this.auth.currentUser;
    if (!u) return false;
    try {
      const snap = await getDoc(doc(this.db, 'admins', u.uid));
      if (!snap.exists()) {
        await firebaseSignOut(this.auth);
        alert('This account is not authorized for administrative access.');
        return false;
      }
      return true;
    } catch (e) {
      console.error('ensureAdmin: admins/{uid} read failed', e);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      document.dispatchEvent(new CustomEvent('tc-before-logout', { bubbles: true }));
    } catch {
      /* ignore */
    }
    try {
      await firebaseSignOut(this.auth);
    } catch (e) {
      console.warn('logout', e);
    }
    await this.router.navigateByUrl('/admin/login');
  }

  async logApiCall(api: string, endpoint: string, params: unknown): Promise<void> {
    try {
      const u = this.auth.currentUser;
      if (!u) return;
      const date = new Date().toISOString().slice(0, 10);
      await addDoc(collection(this.db, 'api_usage', u.uid, 'calls'), {
        api,
        endpoint,
        params: params ?? null,
        success: true,
        timestamp: serverTimestamp(),
        date,
        userId: u.uid,
      });
    } catch (e) {
      console.warn('logApiCall', e);
    }
  }

  async deleteFileByURL(fileURL: string): Promise<void> {
    if (!fileURL || !String(fileURL).includes('firebasestorage.googleapis.com')) return;
    try {
      const m = String(fileURL).match(/\/o\/([^?]+)/);
      if (!m) return;
      const path = decodeURIComponent(m[1]);
      const r = ref(this.storage, path);
      await deleteObject(r);
    } catch (e) {
      console.warn('deleteFileByURL', e);
    }
  }
}
