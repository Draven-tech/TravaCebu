import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import * as firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class ApiTrackerService {
  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth
  ) {}

  async logApiCall(api: string, endpoint: string, params: any) {
    const user = await this.afAuth.currentUser;
    if (!user) return;
    const usageRef = this.firestore.collection(`api_usage/${user.uid}/calls`);
    return usageRef.add({
      userId: user.uid,
      api,
      endpoint,
      params,
      timestamp: new Date()
    });
  }

  async canCallApiToday(api: string, limit: number = 100): Promise<boolean> {
    const user = await this.afAuth.currentUser;
    if (!user) return false;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const usageRef = this.firestore.collection(
      `api_usage/${user.uid}/calls`,
      ref => ref
        .where('api', '==', api)
        .where('timestamp', '>=', firebase.default.firestore.Timestamp.fromDate(startOfDay))
    );
    const snapshot = await usageRef.get().toPromise();
    return ((snapshot?.size ?? 0) < limit);
  }
} 