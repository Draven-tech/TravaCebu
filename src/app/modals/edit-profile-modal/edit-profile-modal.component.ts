import { Component, Input } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { ModalController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-edit-profile-modal',
  standalone: true,
  templateUrl: './edit-profile-modal.component.html',
  styleUrls: ['./edit-profile-modal.component.scss'],
  imports: [
    IonicModule,      // <--- Add this
    FormsModule,      // <--- For ngModel
    CommonModule      // <--- Basic Angular directives
  ]
})
export class EditProfileModalComponent {
  @Input() fullName!: string;
  @Input() username!: string;
  @Input() bio: string = '';

  updatedFullName: string = '';
  updatedUsername: string = '';
  updatedBio: string = ''; 

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.updatedFullName = this.fullName;
    this.updatedUsername = this.username;
    this.updatedBio = this.bio;
  }

  async saveChanges() {
    const user = await this.afAuth.currentUser;
    const uid = user?.uid;

    if (!uid) {
      this.showAlert('Error', 'No user found.');
      return;
    }

    try {
      await this.firestore.collection('users').doc(uid).update({
        fullName: this.updatedFullName,
        username: this.updatedUsername,
        bio: this.updatedBio
      });

      this.showAlert('Success', 'Profile updated successfully!');
      this.modalCtrl.dismiss({
        fullName: this.updatedFullName,
        username: this.updatedUsername,
        bio: this.updatedBio
      });
    } catch (error) {
      this.showAlert('Update Failed', 'Could not update profile.');
      console.error(error);
    }
  }

  close() {
    this.modalCtrl.dismiss();
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
