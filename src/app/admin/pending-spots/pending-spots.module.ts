import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PendingSpotsPageRoutingModule } from './pending-spots-routing.module';
import { PendingSpotsPage } from './pending-spots.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PendingSpotsPageRoutingModule
  ],
  declarations: [PendingSpotsPage]
})
export class PendingSpotsPageModule {} 