import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserGuard } from '../guards/user.guard';
import { UserDashboardPage } from './user-dashboard.page';

const routes: Routes = [
  {
    path: ':uid',
    component: UserDashboardPage,
    canActivate: [UserGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UserDashboardPageRoutingModule {}
