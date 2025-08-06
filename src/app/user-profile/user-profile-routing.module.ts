import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserGuard } from '../guards/user.guard';
import { UserProfilePage } from './user-profile.page';
import { MySubmissionsPage } from './my-submissions/my-submissions.page';

const routes: Routes = [
  {
    path: 'my-submissions',
    component: MySubmissionsPage
  },
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
