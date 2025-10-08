import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BucketListPageRoutingModule } from './bucket-list-routing.module';
import { BucketListPage } from './bucket-list.page';
import { ItineraryModalComponent } from '../components/itinerary-modal/itinerary-modal.component';
import { ItineraryEditorComponent } from '../components/itinerary-editor/itinerary-editor.component';
import { ItineraryMapComponent } from '../components/itinerary-map/itinerary-map.component';
import { PlaceAssignmentPickerComponent } from '../components/place-assignment-picker/place-assignment-picker.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { RestaurantCardComponent } from '../components/restaurant-card/restaurant-card.component';
import { ComponentsModule } from '../components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BucketListPageRoutingModule,
    DragDropModule,
    ComponentsModule
  ],
  declarations: [
    BucketListPage,

  ]
})
export class BucketListPageModule {}
