import { NgModule } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { AdminRoutingModule } from './admin-routing.module';

import { LoginPage } from './login/login.page';
import { DashboardPage } from './dashboard/dashboard.page';

@NgModule({
  declarations: [
    LoginPage,
    DashboardPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    AdminRoutingModule
  ],
  providers: [
    DatePipe
  ]
})
export class AdminModule {}
