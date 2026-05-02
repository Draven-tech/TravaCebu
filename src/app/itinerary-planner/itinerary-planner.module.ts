import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ItineraryPlannerPageRoutingModule } from './itinerary-planner-routing.module';

import { ItineraryPlannerPage } from './itinerary-planner.page';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ComponentsModule } from '../components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ItineraryPlannerPageRoutingModule,
    DragDropModule,
    ComponentsModule
  ],
  declarations: [ItineraryPlannerPage]
})
export class ItineraryPlannerPageModule {}
