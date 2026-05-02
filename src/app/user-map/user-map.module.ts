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
import { ItineraryCompletionModalComponent } from '../modals/itinerary-completion-modal/itinerary-completion-modal.component';
import { LocalTipsModalComponent } from '../modals/local-tips-modal/local-tips-modal.component';
import { EventDetailModalComponent } from '../modals/event-detail-modal/event-detail-modal.component';

@NgModule({
  declarations: [
    UserMapPage,
    ItineraryControlsModalComponent,
    ItineraryCompletionModalComponent,
    LocalTipsModalComponent
  ],
  imports: [
    CommonModule,
    TouristSpotSheetComponent,
    DaySpotPickerComponent,
    IonicModule,
    FormsModule,
    UserMapPageRoutingModule,
    ComponentsModule,
    EventDetailModalComponent
  ]
})
export class UserMapPageModule {}
