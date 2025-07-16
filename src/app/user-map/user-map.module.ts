import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UserMapPageRoutingModule } from './user-map-routing.module';

import { UserMapPage } from './user-map.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    UserMapPageRoutingModule
  ],
  declarations: [UserMapPage]
})
export class UserMapPageModule {}
