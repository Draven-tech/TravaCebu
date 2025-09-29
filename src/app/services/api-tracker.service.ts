import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Injectable({
  providedIn: 'root'
})
export class ApiTrackerService {

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth
  ) { }

  async logApiCall(api: string, endpoint: string, params?: any): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        return;
      }

      const callData = {
        api,
        endpoint,
        params,
        success: true,
        timestamp: new Date(),
        date: new Date().toISOString().split('T')[0],
        userId: user.uid
      };

      await this.firestore.collection(`api_usage/${user.uid}/calls`).add(callData);
    } catch (error) {
      console.error('Error logging API call:', error);
    }
  }

  async canCallApiToday(api: string, limit: number = 100): Promise<boolean> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        return false;
      }
      
      const today = new Date().toISOString().split('T')[0];
      const usageRef = this.firestore.collection(
        `api_usage/${user.uid}/calls`,
        ref => ref
          .where('api', '==', api)
          .where('date', '==', today)
      );
      
      const snapshot = await usageRef.get().toPromise();
      const currentUsage = snapshot?.size ?? 0;
      
      return currentUsage < limit;
    } catch (error) {
      console.error('Error checking API limits:', error);
      return true; // Allow calls if we can't check limits
    }
  }

  async getApiUsageStats(): Promise<any> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        return { total: 0, today: 0, byApi: {} };
      }
      
      // Check if user is admin first
      const adminDoc = await this.firestore.doc(`admins/${user.uid}`).get().toPromise();
      const isAdmin = adminDoc?.exists;
      
      let totalCalls = 0;
      let todayCalls = 0;
      const byApi: any = {};
      
      if (isAdmin) {
        // Admin can read all API usage data
        const allUsageRef = this.firestore.collectionGroup('calls');
        const snapshot = await allUsageRef.get().toPromise();
        
        const today = new Date().toISOString().split('T')[0];
        
        snapshot?.docs.forEach((doc) => {
          const data = doc.data() as any;
          
          totalCalls++;
          
          if (data.date === today) {
            todayCalls++;
          }
          
          if (!byApi[data.api]) {
            byApi[data.api] = { total: 0, today: 0 };
          }
          byApi[data.api].total++;
          
          if (data.date === today) {
            byApi[data.api].today++;
          }
        });
      } else {
        // Regular user can only read their own data
        const usageRef = this.firestore.collection(`api_usage/${user.uid}/calls`);
        const snapshot = await usageRef.get().toPromise();
        
        const today = new Date().toISOString().split('T')[0];
        
        snapshot?.docs.forEach((doc) => {
          const data = doc.data() as any;
          
          totalCalls++;
          
          if (data.date === today) {
            todayCalls++;
          }
          
          if (!byApi[data.api]) {
            byApi[data.api] = { total: 0, today: 0 };
          }
          byApi[data.api].total++;
          
          if (data.date === today) {
            byApi[data.api].today++;
          }
        });
      }
      
      return { total: totalCalls, today: todayCalls, byApi };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return { total: 0, today: 0, byApi: {} };
    }
  }

  async verifyUserData(): Promise<any> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        return { userExists: false, dataExists: false, error: 'No authenticated user' };
      }

      const userDoc = await this.firestore.doc(`users/${user.uid}`).get().toPromise();
      const usageRef = this.firestore.collection(`api_usage/${user.uid}/calls`);
      const usageSnapshot = await usageRef.get().toPromise();

      return {
        userExists: userDoc?.exists || false,
        dataExists: usageSnapshot && usageSnapshot.size > 0,
        error: null
      };
    } catch (error) {
      return {
        userExists: false,
        dataExists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
