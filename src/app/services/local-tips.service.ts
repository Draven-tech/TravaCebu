import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { map, Observable } from 'rxjs';

export type LocalTipStatus = 'pending' | 'approved' | 'rejected';

export interface PendingLocalTip {
  id?: string;
  spotId: string;
  spotName: string;
  tipText: string;
  normalizedTip: string;
  submittedBy: string;
  submittedAt: Date;
  status: LocalTipStatus;
  reviewNotes?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export interface ApprovedLocalTip {
  id?: string;
  tipText: string;
  submittedBy: string;
  submittedAt: Date;
  approvedAt: Date;
  approvedBy: string;
  sourcePendingTipId: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocalTipsService {
  private readonly minTipLength = 20;
  private readonly maxTipLength = 300;
  private readonly maxDailyPendingTips = 3;

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth
  ) {}

  getApprovedTipsForSpot(spotId: string): Observable<ApprovedLocalTip[]> {
    return this.firestore
      .collection<ApprovedLocalTip>(`tourist_spots/${spotId}/local_tips`, ref => ref.orderBy('approvedAt', 'desc'))
      .valueChanges({ idField: 'id' });
  }

  getPendingTips(): Observable<PendingLocalTip[]> {
    return this.getTipsByStatus('pending');
  }

  getTipsByStatus(status: LocalTipStatus): Observable<PendingLocalTip[]> {
    return this.firestore
      .collection<PendingLocalTip>('pending_local_tips', ref => ref.where('status', '==', status))
      .valueChanges({ idField: 'id' })
      .pipe(
        map((tips) =>
          tips.sort((a, b) => {
            const dateA = a.submittedAt instanceof Date ? a.submittedAt : new Date(a.submittedAt);
            const dateB = b.submittedAt instanceof Date ? b.submittedAt : new Date(b.submittedAt);
            return dateB.getTime() - dateA.getTime();
          })
        )
      );
  }

  async submitTip(spotId: string, spotName: string, tipText: string): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to submit a local tip.');
    }

    const cleanedTip = this.cleanTipText(tipText);
    this.validateTipText(cleanedTip);

    const normalizedTip = this.normalizeTip(cleanedTip);

    await this.assertNotDuplicate(user.uid, spotId, normalizedTip);
    await this.assertDailyLimit(user.uid);

    const pendingTip: PendingLocalTip = {
      spotId,
      spotName,
      tipText: cleanedTip,
      normalizedTip,
      submittedBy: user.uid,
      submittedAt: new Date(),
      status: 'pending',
      reviewNotes: ''
    };

    await this.firestore.collection('pending_local_tips').add(pendingTip);
  }

  async approveTip(tipId: string, reviewNotes?: string): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const tipRef = this.firestore.collection('pending_local_tips').doc<PendingLocalTip>(tipId);
    const tipDoc = await tipRef.get().toPromise();
    if (!tipDoc?.exists) {
      throw new Error('Pending tip not found');
    }

    const tipData = tipDoc.data() as PendingLocalTip;
    if (tipData.status !== 'pending') {
      throw new Error('Only pending tips can be approved');
    }

    const approvedDoc: ApprovedLocalTip = {
      tipText: tipData.tipText,
      submittedBy: tipData.submittedBy,
      submittedAt: tipData.submittedAt,
      approvedAt: new Date(),
      approvedBy: user.uid,
      sourcePendingTipId: tipId
    };

    await this.firestore.collection(`tourist_spots/${tipData.spotId}/local_tips`).add(approvedDoc);

    await tipRef.update({
      status: 'approved',
      reviewNotes: reviewNotes || '',
      reviewedAt: new Date(),
      reviewedBy: user.uid
    });
  }

  async rejectTip(tipId: string, reviewNotes: string): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const reason = (reviewNotes || '').trim();
    if (!reason) {
      throw new Error('Rejection reason is required');
    }

    await this.firestore.collection('pending_local_tips').doc(tipId).update({
      status: 'rejected',
      reviewNotes: reason,
      reviewedAt: new Date(),
      reviewedBy: user.uid
    });
  }

  private validateTipText(value: string): void {
    if (!value) {
      throw new Error('Tip cannot be empty.');
    }
    if (value.length < this.minTipLength) {
      throw new Error(`Tip must be at least ${this.minTipLength} characters.`);
    }
    if (value.length > this.maxTipLength) {
      throw new Error(`Tip must not exceed ${this.maxTipLength} characters.`);
    }
  }

  private cleanTipText(value: string): string {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  private normalizeTip(value: string): string {
    return this.cleanTipText(value).toLowerCase();
  }

  private async assertNotDuplicate(userId: string, spotId: string, normalizedTip: string): Promise<void> {
    const snapshot = await this.firestore
      .collection<PendingLocalTip>('pending_local_tips', ref =>
        ref
          .where('submittedBy', '==', userId)
          .where('spotId', '==', spotId)
          .where('normalizedTip', '==', normalizedTip)
          .limit(1)
      )
      .get()
      .toPromise();

    if (snapshot && !snapshot.empty) {
      throw new Error('You already submitted this tip for this destination.');
    }
  }

  private async assertDailyLimit(userId: string): Promise<void> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const snapshot = await this.firestore
      .collection<PendingLocalTip>('pending_local_tips', ref =>
        ref
          .where('submittedBy', '==', userId)
          .where('submittedAt', '>=', startOfDay)
      )
      .get()
      .toPromise();

    const pendingToday = (snapshot?.docs || []).filter((doc) => {
      const data = doc.data();
      return data?.status === 'pending';
    }).length;

    if (pendingToday >= this.maxDailyPendingTips) {
      throw new Error(`You can submit up to ${this.maxDailyPendingTips} pending tips per day.`);
    }
  }
}
