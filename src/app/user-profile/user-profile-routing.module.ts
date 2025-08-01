import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserGuard } from '../guards/user.guard';
import { UserProfilePage } from './user-profile.page';

const routes: Routes = [
  {
    path: ':uid',
    component: UserProfilePage,
    canActivate: [UserGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UserProfilePageRoutingModule {}
