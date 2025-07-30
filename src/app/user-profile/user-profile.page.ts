import { Component, ViewChild, OnInit, ElementRef  } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../services/auth.service';
import { NavController, AlertController } from '@ionic/angular';
import { StorageService } from '../services/storage.service';
import { ActionSheetController, ModalController } from '@ionic/angular';
import { ViewProfilePictureComponent } from '../modals/view-profile-picture/view-profile-picture.component';
import { EditProfileModalComponent } from '../modals/edit-profile-modal/edit-profile-modal.component';
import { MenuController } from '@ionic/angular';




@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.page.html',
  styleUrls: ['./user-profile.page.scss'],
  standalone: false,
})
export class UserProfilePage implements OnInit {
  userId: string | null = null;
  userData: any = null;
  uploading: boolean = false;
  activeTab = 'tab-1';

  @ViewChild('avatarInput') avatarInput!: ElementRef<HTMLInputElement>;

  constructor(
    private route: ActivatedRoute,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private authService: AuthService,
    private navCtrl: NavController,
    private storageService: StorageService,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private modalCtrl: ModalController,
    private menuCtrl: MenuController
  ) {}

  async ngOnInit() {
    // Get Firebase Auth UID
    const currentUser = await this.afAuth.currentUser;
    this.userId = this.route.snapshot.paramMap.get('uid') ?? currentUser?.uid ?? null;
    if (!this.userId) {
      return;
    }
    
    // Load user profile data
    this.firestore.collection('users').doc(this.userId).valueChanges().subscribe(data => {
      this.userData = data;
    });

    this.menuCtrl.enable(true, 'main-menu');
  }

  openAvatarOptions() {
    this.avatarInput.nativeElement.click();
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  async presentAvatarOptions() {
  const actionSheet = await this.actionSheetCtrl.create({
    header: 'Profile Picture',
    cssClass: 'avatar-action-sheet',
    buttons: [
      {
        text: 'View Profile Picture',
        icon: 'eye-outline',
        handler: () => this.viewProfilePicture()
      },
      {
        text: 'Change Profile Picture',
        icon: 'image-outline',
        handler: () => this.avatarInput.nativeElement.click()
      },
      {
        text: 'Cancel',
        icon: 'close',
        role: 'cancel'
      }
    ]
  });
  await actionSheet.present();
}

async viewProfilePicture() {
  const modal = await this.modalCtrl.create({
    component: ViewProfilePictureComponent,
    componentProps: {
      photoURL: this.userData?.photoURL || 'assets/default.png'
    },
    cssClass: 'profile-modal',
    showBackdrop: true,
    backdropDismiss: true
  });
  await modal.present();
}


async openEditProfileModal() {
  const modal = await this.modalCtrl.create({
    component: EditProfileModalComponent,
    cssClass: 'edit-profile-modal-class fullscreen',
    componentProps: {
      fullName: this.userData?.fullName,
      username: this.userData?.username,
      bio: this.userData?.bio
    },
    backdropDismiss: true,
    showBackdrop: true
  });

  await modal.present();

  const { data } = await modal.onWillDismiss();
  if (data) {
    // update the view with returned data if needed
    this.userData.fullName = data.fullName;
    this.userData.username = data.username;
    this.userData.bio = data.bio;
  }
}



  async onAvatarSelected(event: any) {
  const file: File = event.target.files[0];
  if (!file) return;

  const user = await this.afAuth.currentUser;
  const uid = user?.uid;
  if (!uid) return;

  const filePath = `profile_pictures/${uid}_${Date.now()}_${file.name}`;
  this.uploading = true;

  try {
    const url = await this.storageService.uploadFile(filePath, file);
    await this.firestore.collection('users').doc(uid).update({ photoURL: url });
    this.userData.photoURL = url;

    this.showAlert('Success', 'Profile picture updated!');
  } catch (err) {
    console.error('Upload error:', err);
    this.showAlert('Error', 'Failed to update profile picture');
  } finally {
    this.uploading = false;
  }
}

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }


  async logout() {
    await this.authService.logoutUser();
  }

  goToHome() {
    this.navCtrl.navigateForward('/user-dashboard');
  }
}
