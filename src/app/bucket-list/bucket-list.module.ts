import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BucketListPageRoutingModule } from './bucket-list-routing.module';
import { BucketListPage } from './bucket-list.page';
import { ItineraryModalComponent } from './itinerary-modal.component';
import { ItineraryEditorComponent } from './itinerary-editor.component';
import { DragDropModule } from '@angular/cdk/drag-drop';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BucketListPageRoutingModule,
    DragDropModule
  ],
  declarations: [
    BucketListPage,
    ItineraryModalComponent,
    ItineraryEditorComponent
  ]
})
export class BucketListPageModule {}
