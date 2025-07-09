import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AdminGuard } from '../guards/admin.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then(m => m.LoginPageModule),
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardPageModule),
    canActivate: [AdminGuard]
  },
  {
    path: 'route-editor-map',
    loadChildren: () => import('./route-editor-map/route-editor-map.module').then(m => m.RouteEditorMapPageModule),
    canActivate: [AdminGuard]
  },

  {
  path: 'route-list',
  loadChildren: () => import('./route-list/route-list.module').then(m => m.RouteListPageModule),
  canActivate: [AdminGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule {}