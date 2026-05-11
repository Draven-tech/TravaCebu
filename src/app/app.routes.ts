import { Routes } from '@angular/router';
import { adminGuard } from './admin.guard';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TouristSpotsListComponent } from './pages/tourist-spots-list/tourist-spots-list.component';
import { TouristSpotEditorComponent } from './pages/tourist-spot-editor/tourist-spot-editor.component';
import { EventsListComponent } from './pages/events-list/events-list.component';
import { EventEditorComponent } from './pages/event-editor/event-editor.component';
import { PendingSpotsComponent } from './pages/pending-spots/pending-spots.component';
import { PendingTipsComponent } from './pages/pending-tips/pending-tips.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'admin/login' },
  { path: 'admin/login', component: LoginComponent },
  { path: 'admin/dashboard', component: DashboardComponent, canActivate: [adminGuard] },
  { path: 'admin/tourist-spots', component: TouristSpotsListComponent, canActivate: [adminGuard] },
  {
    path: 'admin/tourist-spots/editor',
    component: TouristSpotEditorComponent,
    canActivate: [adminGuard],
  },
  { path: 'admin/events', component: EventsListComponent, canActivate: [adminGuard] },
  { path: 'admin/events/editor', component: EventEditorComponent, canActivate: [adminGuard] },
  {
    path: 'admin/moderation/pending-spots',
    component: PendingSpotsComponent,
    canActivate: [adminGuard],
  },
  {
    path: 'admin/moderation/pending-tips',
    component: PendingTipsComponent,
    canActivate: [adminGuard],
  },
  { path: '**', redirectTo: 'admin/login' },
];
