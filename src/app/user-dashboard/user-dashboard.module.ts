import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UserDashboardPageRoutingModule } from './user-dashboard-routing.module';

import { UserDashboardPage } from './user-dashboard.page';
import { SearchModalComponent } from '../modals/search-modal/search-modal.component';
import { VisitedSpotsModalComponent } from '../modals/visited-spots-modal/visited-spots-modal.component';
import { ComponentsModule } from '../components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    UserDashboardPageRoutingModule,
    ComponentsModule
  ],
  declarations: [UserDashboardPage, SearchModalComponent, VisitedSpotsModalComponent]
})
export class UserDashboardPageModule {}
