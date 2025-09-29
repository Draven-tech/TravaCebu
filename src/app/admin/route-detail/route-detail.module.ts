import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouteDetailPage } from './route-detail.page';
import { DatePipe } from '@angular/common';

@NgModule({
  imports: [
    CommonModule,
    IonicModule
  ],
  declarations: [RouteDetailPage],
  providers: [DatePipe]
})
export class RouteDetailPageModule {}
