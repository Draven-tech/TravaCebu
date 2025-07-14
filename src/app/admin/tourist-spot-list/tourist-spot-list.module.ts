import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TouristSpotListPageRoutingModule } from './tourist-spot-list-routing.module';

import { TouristSpotListPage } from './tourist-spot-list.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TouristSpotListPageRoutingModule
  ],
  declarations: [TouristSpotListPage]
})
export class TouristSpotListPageModule {}
