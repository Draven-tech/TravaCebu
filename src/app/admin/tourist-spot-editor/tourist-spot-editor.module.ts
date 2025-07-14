import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TouristSpotEditorPageRoutingModule } from './tourist-spot-editor-routing.module';

import { TouristSpotEditorPage } from './tourist-spot-editor.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TouristSpotEditorPageRoutingModule
  ],
  declarations: [TouristSpotEditorPage]
})
export class TouristSpotEditorPageModule {}
