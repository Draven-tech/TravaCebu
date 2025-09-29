import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UserDashboardPageRoutingModule } from './user-dashboard-routing.module';

import { UserDashboardPage } from './user-dashboard.page';
import { SearchModalComponent } from './search-modal.component';
import { ComponentsModule } from '../components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    UserDashboardPageRoutingModule,
    ComponentsModule
  ],
  declarations: [UserDashboardPage, SearchModalComponent]
})
export class UserDashboardPageModule {}
