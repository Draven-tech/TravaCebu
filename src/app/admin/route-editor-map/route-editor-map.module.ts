import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { RouteEditorMapPageRoutingModule } from './route-editor-map-routing.module';

import { RouteEditorMapPage } from './route-editor-map.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouteEditorMapPageRoutingModule
  ],
  declarations: [RouteEditorMapPage]
})
export class RouteEditorMapPageModule {}
