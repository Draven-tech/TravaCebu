import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { AdminAuthService } from '../../services/admin-auth.service';
import { AdminUiService } from '../../services/admin-ui.service';
import type { DocumentData, UpdateData } from 'firebase/firestore';

@Component({
  selector: 'app-pending-tips',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pending-tips.component.html',
})
export class PendingTipsComponent implements OnInit {
  private readonly authSvc = inject(AdminAuthService);
  private readonly ui = inject(AdminUiService);

  status: 'pending' | 'approved' | 'rejected' = 'pending';
  rows: { id: string; data: DocumentData }[] = [];
  uid = '';
  /** Shown while Firestore loads after changing status segment. */
  tabPanelLoading = false;

  async ngOnInit(): Promise<void> {
    await this.authSvc.auth.authStateReady();
    const u = this.authSvc.auth.currentUser;
    if (u) this.uid = u.uid;
    await this.load();
  }

  async load(): Promise<void> {
    this.tabPanelLoading = true;
    try {
      const snap = await getDocs(
        query(collection(this.authSvc.db, 'pending_local_tips'), where('status', '==', this.status)),
      );
      this.rows = [];
      snap.forEach((d) => this.rows.push({ id: d.id, data: d.data() }));
    } finally {
      this.tabPanelLoading = false;
    }
  }

  async approve(row: { id: string }): Promise<void> {
    const docRef = doc(this.authSvc.db, 'pending_local_tips', row.id);
    const p = (await getDoc(docRef)).data();
    if (!p) return;
    if ((p['status'] || '') !== 'pending') {
      await this.ui.alert('This tip is no longer pending.', 'Cannot approve');
      return;
    }
    const spotId = (p['spotId'] as string) || '';
    if (!spotId) {
      await this.ui.alert('This tip has no linked spot (spotId).', 'Cannot approve');
      return;
    }
    const notesRaw = await this.ui.prompt({
      title: 'Approve tip',
      message: 'Optional notes.',
      defaultValue: '',
    });
    const notes = notesRaw === null ? '' : notesRaw;
    const now = Timestamp.now();
    const subAt = (p['submittedAt'] as Timestamp) || now;
    const subBy = (p['submittedBy'] as string) || '';
    await addDoc(collection(this.authSvc.db, 'tourist_spots', spotId, 'local_tips'), {
      tipText: p['tipText'] || '',
      submittedBy: subBy,
      submittedAt: subAt,
      approvedAt: now,
      approvedBy: this.uid,
      sourcePendingTipId: row.id,
    });
    const upd: Record<string, unknown> = { status: 'approved', reviewedAt: now, reviewedBy: this.uid };
    if (notes.trim()) upd['reviewNotes'] = notes.trim();
    await updateDoc(docRef, upd as UpdateData<DocumentData>);
    await this.load();
  }

  async reject(row: { id: string }): Promise<void> {
    const notes = await this.ui.prompt({
      title: 'Reject tip',
      message: 'Reason (required).',
      placeholder: 'Reason…',
      required: true,
      multiline: true,
    });
    if (notes === null) return;
    await updateDoc(doc(this.authSvc.db, 'pending_local_tips', row.id), {
      status: 'rejected',
      reviewNotes: notes.trim(),
      reviewedAt: Timestamp.now(),
      reviewedBy: this.uid,
    });
    await this.load();
  }

  setStatus(s: 'pending' | 'approved' | 'rejected'): void {
    this.status = s;
    void this.load();
  }

  async logout(): Promise<void> {
    await this.authSvc.logout();
  }
}
