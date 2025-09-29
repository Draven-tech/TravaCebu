import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TouristSpotDetailPageRoutingModule } from './tourist-spot-detail-routing.module';

import { TouristSpotDetailPage } from './tourist-spot-detail.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TouristSpotDetailPageRoutingModule
  ],
  declarations: [TouristSpotDetailPage]
})
export class TouristSpotDetailPageModule {}
