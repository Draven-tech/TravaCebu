import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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


// Services
import { AuthService } from '../services/auth.service';

// Firebase
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { environment } from '../../environments/environment';

// Other Modules
import { LeafletModule } from '@asymmetrik/ngx-leaflet';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule.forRoot(),
    AdminRoutingModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule,
    LeafletModule
  ],
  providers: [AuthService]
})
export class AdminModule { }