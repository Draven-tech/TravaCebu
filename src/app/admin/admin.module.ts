import { NgModule } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

// Routing
import { AdminRoutingModule } from './admin-routing.module';

// Pages
import { LoginPage } from './login/login.page';
import { DashboardPage } from './dashboard/dashboard.page';
import { RouteEditorMapPage } from './route-editor-map/route-editor-map.page';
import { RouteListPage } from './route-list/route-list.page';
import { RouteDetailPage } from './route-detail/route-detail.page';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [
    LoginPage,
    DashboardPage,
    RouteEditorMapPage,
    RouteListPage,
    RouteDetailPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule.forRoot(), // This imports all Ionic components
    AdminRoutingModule,
    HttpClientModule
  ],
  providers: [
    DatePipe // Add DatePipe to providers
  ]
})
export class AdminModule {}