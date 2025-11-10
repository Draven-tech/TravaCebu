import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFirestoreModule, SETTINGS } from '@angular/fire/compat/firestore'; 
import { environment } from '../environments/environment';
import { HttpClientModule } from '@angular/common/http'; 
import { initializeApp } from 'firebase/app';


import { ItineraryEditorComponent } from './components/itinerary-editor/itinerary-editor.component';
import { DaySpotPickerComponent } from './components/day-spot-picker/day-spot-picker.component';
import { PlaceAssignmentPickerComponent } from './components/place-assignment-picker/place-assignment-picker.component';  
import { ItineraryModalComponent } from './components/itinerary-modal/itinerary-modal.component';
import { ItineraryMapComponent } from './components/itinerary-map/itinerary-map.component';
import { ViewItineraryModalComponent } from './modals/view-itinerary-modal/view-itinerary-modal.component';
import { SearchModalComponent } from './modals/search-modal/search-modal.component';


try {
  initializeApp(environment.firebase);
  } catch (error) {
  console.error('Error initializing Firebase:', error);
}

@NgModule({
  declarations: [AppComponent,
   // DaySpotPickerComponent,
    PlaceAssignmentPickerComponent,
    ItineraryModalComponent,
    ItineraryMapComponent,
    ItineraryEditorComponent,
    //ViewItineraryModalComponent,

    
  ],
  imports: [
    HttpClientModule,
    BrowserModule, 
    IonicModule.forRoot(), 
    AppRoutingModule,
     FormsModule,
     DragDropModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule.enablePersistence()
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule {}
