import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { RouteListPageRoutingModule } from './route-list-routing.module';

import { RouteListPage } from './route-list.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouteListPageRoutingModule
  ],
  declarations: [RouteListPage]
})
export class RouteListPageModule {}
