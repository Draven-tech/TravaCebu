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
import { AdminShellComponent } from './components/admin-shell/admin-shell.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'admin/login' },
  { path: 'admin/login', component: LoginComponent },
  {
    path: 'admin',
    component: AdminShellComponent,
    canActivate: [adminGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'tourist-spots/editor', component: TouristSpotEditorComponent },
      { path: 'tourist-spots', component: TouristSpotsListComponent },
      { path: 'events/editor', component: EventEditorComponent },
      { path: 'events', component: EventsListComponent },
      { path: 'moderation/pending-spots', component: PendingSpotsComponent },
      { path: 'moderation/pending-tips', component: PendingTipsComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'admin/login' },
];
