import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

export const USER_SOCIAL_POSTS_CREATED_COUNT_FIELD = 'socialPostsCreatedCount';
export const USER_SOCIAL_COMMENTS_MADE_COUNT_FIELD = 'socialCommentsMadeCount';
export const USER_SOCIAL_LIKES_GIVEN_COUNT_FIELD = 'socialLikesGivenCount';

@Injectable({
  providedIn: 'root'
})
export class UserSocialCountsService {
  constructor(private firestore: AngularFirestore) {}

  incrementSocialPostsCreatedCount(uid?: string | null): Promise<void> {
    return this.incrementUserNumericField(uid, USER_SOCIAL_POSTS_CREATED_COUNT_FIELD, 'socialPostsCreatedCount');
  }

  incrementSocialCommentsMadeCount(uid?: string | null): Promise<void> {
    return this.incrementUserNumericField(uid, USER_SOCIAL_COMMENTS_MADE_COUNT_FIELD, 'socialCommentsMadeCount');
  }

  incrementSocialLikesGivenCount(uid?: string | null): Promise<void> {
    return this.incrementUserNumericField(uid, USER_SOCIAL_LIKES_GIVEN_COUNT_FIELD, 'socialLikesGivenCount');
  }

  private async incrementUserNumericField(
    uid: string | null | undefined,
    field: string,
    logLabel: string
  ): Promise<void> {
    if (!uid) {
      console.warn(`[UserSocialCounts] ${logLabel} not updated: missing user id.`);
      return;
    }
    const db = this.firestore.firestore;
    const ref = db.collection('users').doc(uid);
    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        let n = 0;
        if (snap.exists) {
          const v = (snap.data() as Record<string, unknown> | undefined)?.[field];
          if (typeof v === 'number' && !Number.isNaN(v)) {
            n = v;
          } else if (v != null) {
            const parsed = Number(v);
            if (!Number.isNaN(parsed)) {
              n = parsed;
            }
          }
        }
        transaction.set(ref, { [field]: n + 1 }, { merge: true });
      });
    } catch (e) {
      console.error(`[UserSocialCounts] ${logLabel} update failed:`, e);
    }
  }
}
