import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CompletedItinerariesPageRoutingModule } from './completed-itineraries-routing.module';

import { CompletedItinerariesPage } from './completed-itineraries.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CompletedItinerariesPageRoutingModule
  ],
  declarations: [CompletedItinerariesPage]
})
export class CompletedItinerariesPageModule {}
