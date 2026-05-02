import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PendingLocalTipsPageRoutingModule } from './pending-local-tips-routing.module';
import { PendingLocalTipsPage } from './pending-local-tips.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PendingLocalTipsPageRoutingModule
  ],
  declarations: [PendingLocalTipsPage]
})
export class PendingLocalTipsPageModule {}
