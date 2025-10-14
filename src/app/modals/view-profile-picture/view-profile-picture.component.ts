import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, NavController } from '@ionic/angular';

@Component({
  standalone: true,
  selector: 'app-view-profile-picture',
  imports: [CommonModule, IonicModule],
  template: `
    <ion-content class="profile-view-container">
      <ion-button fill="clear" class="close-btn" (click)="closeToProfile()">
        <ion-icon name="close-outline" slot="icon-only"></ion-icon>
      </ion-button>
      <div class="image-wrapper">
        <img [src]="photoURL" class="profile-image" />
      </div>
    </ion-content>
  `,
  styleUrls: ['./view-profile-picture.component.scss'] // ✅œ… linked SCSS
})
export class ViewProfilePictureComponent {
  @Input() photoURL: string = '';

  constructor(
    private modalCtrl: ModalController,
    private navCtrl: NavController
  ) {}

  async closeToProfile() {
    await this.modalCtrl.dismiss();
    this.navCtrl.navigateRoot('/user-profile');
  }
}
