import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UserMapPageRoutingModule } from './user-map-routing.module';

import { UserMapPage } from './user-map.page';
import { TouristSpotSheetComponent } from './tourist-spot-sheet.component';
import { DaySpotPickerComponent } from './day-spot-picker.component';
import { ComponentsModule } from '../components/components.module';

@NgModule({
  declarations: [
    UserMapPage
  ],
  imports: [
    CommonModule,
    TouristSpotSheetComponent,
    DaySpotPickerComponent,
    IonicModule,
    FormsModule,
    UserMapPageRoutingModule,
    ComponentsModule
  ]
})
export class UserMapPageModule {}
