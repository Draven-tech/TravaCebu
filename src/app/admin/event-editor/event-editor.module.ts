import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { EventEditorPageRoutingModule } from './event-editor-routing.module';

import { EventEditorPage } from './event-editor.page';

import { AngularFirestoreModule } from '@angular/fire/compat/firestore';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EventEditorPageRoutingModule,
    AngularFirestoreModule
  ],
  declarations: [EventEditorPage]
})
export class EventEditorPageModule {}
