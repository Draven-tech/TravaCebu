import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { MyItinerariesPageRoutingModule } from './my-itineraries-routing.module';
import { MyItinerariesPage } from './my-itineraries.page';
import { ComponentsModule } from '../components/components.module';
import { ViewItineraryModalComponent } from '../modals/view-itinerary-modal/view-itinerary-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MyItinerariesPageRoutingModule,
    ComponentsModule
  ],
  declarations: [MyItinerariesPage, ViewItineraryModalComponent],
  exports: [ViewItineraryModalComponent]
})
export class MyItinerariesPageModule {}
