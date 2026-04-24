import { Component, Input } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { BadgeService } from '../../services/badge.service';

@Component({
  selector: 'app-comments-modal',
  templateUrl: './comments-modal.component.html',
  styleUrls: ['./comments-modal.component.scss'],
  standalone: false,
})
export class CommentsModalComponent {
  @Input() post: any = null;
  
  newComment: string = '';
  comments: any[] = [];
  userData: any = null;

  constructor(
    private modalCtrl: ModalController,
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private alertCtrl: AlertController,
    private badgeService: BadgeService
  ) {
    this.loadUserData();
  }

  async loadUserData() {
    const currentUser = await this.afAuth.currentUser;
    if (currentUser) {
      this.firestore.collection('users').doc(currentUser.uid).valueChanges().subscribe(data => {
        this.userData = data;
      });
    }
  }

  private commentAuthorName(
    profile: any,
    authUser: { displayName: string | null; email: string | null; photoURL: string | null }
  ): string {
    const full = String(profile?.fullName || '').trim();
    if (full) return full;
    const fromParts = [profile?.firstName, profile?.lastName]
      .map((s: string) => String(s || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    if (fromParts) return fromParts;
    const username = String(profile?.username || '').trim();
    if (username) return username;
    const display = String(authUser.displayName || '').trim();
    if (display) return display;
    const emailLocal = String(authUser.email || '').split('@')[0].trim();
    if (emailLocal) return emailLocal;
    return 'Anonymous';
  }

  async addComment() {
    if (!this.newComment.trim()) return;

    const currentUser = await this.afAuth.currentUser;
    if (!currentUser) return;

    const userSnap = await this.firestore.collection('users').doc(currentUser.uid).get().toPromise();
    const profile = userSnap?.data() as any;

    const commentData = {
      userId: currentUser.uid,
      userName: this.commentAuthorName(profile, currentUser),
      userPhotoURL:
        profile?.photoURL || currentUser.photoURL || 'assets/img/default.png',
      content: this.newComment.trim(),
      timestamp: new Date()
    };

    try {
      const updatedComments = [...(this.post.comments || []), commentData];
      await this.firestore.collection('posts').doc(this.post.id).update({
        comments: updatedComments
      });
      
      // Evaluate social butterfly badge for the commenter
      try {
        if (profile) {
          await this.badgeService.evaluateSocialButterflyBadge(currentUser.uid, profile);
        }
      } catch (error) {
        console.error('Error evaluating social butterfly badge:', error);
      }
      
      this.newComment = '';
      this.showAlert('Success', 'Comment added successfully!');
    } catch (error: any) {
      console.error('Error adding comment:', error);
      this.showAlert('Error', `Failed to add comment: ${error.message || error}`);
    }
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
