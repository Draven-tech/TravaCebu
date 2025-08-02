import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UserProfilePageRoutingModule } from './user-profile-routing.module';

import { UserProfilePage } from './user-profile.page';
import { BottomNavModule } from '../components/bottom-nav/bottom-nav.module';
import { CreatePostModalComponent } from '../modals/create-post-modal/create-post-modal.component';
import { CommentsModalComponent } from '../modals/comments-modal/comments-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    UserProfilePageRoutingModule,
    BottomNavModule
  ],
  declarations: [
    UserProfilePage,
    CreatePostModalComponent,
    CommentsModalComponent
  ]
})
export class UserProfilePageModule {}
