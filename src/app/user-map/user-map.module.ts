import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UserMapPageRoutingModule } from './user-map-routing.module';

import { UserMapPage } from './user-map.page';
import { TouristSpotSheetComponent } from '../components/tourist-spot-sheet/tourist-spot-sheet.component';
import { DaySpotPickerComponent } from '../components/day-spot-picker/day-spot-picker.component';
import { ComponentsModule } from '../components/components.module';
import { ItineraryControlsModalComponent } from '../modals/itinerary-controls-modal/itinerary-controls-modal.component';

@NgModule({
  declarations: [
    UserMapPage,
    ItineraryControlsModalComponent
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
