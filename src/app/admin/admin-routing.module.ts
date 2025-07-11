import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AdminGuard } from '../guards/admin.guard';
import { RouteListPage } from './route-list/route-list.page';
import { RouteEditorMapPage } from './route-editor-map/route-editor-map.page';
import { DashboardPage } from './dashboard/dashboard.page';
import { LoginPage } from './login/login.page';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginPage
  },
  {
    path: 'dashboard',
    component: DashboardPage,
    canActivate: [AdminGuard]
  },
  {
    path: 'route-list',
    component: RouteListPage,
    canActivate: [AdminGuard]
  },
  {
    path: 'route-editor',
    component: RouteEditorMapPage,
    canActivate: [AdminGuard]
  },
  {
    path: 'route-editor/:id',
    component: RouteEditorMapPage,
    canActivate: [AdminGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule {}