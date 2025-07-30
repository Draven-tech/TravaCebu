import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserGuard } from '../guards/user.guard';
import { UserCalendarPage } from './user-calendar.page';

const routes: Routes = [
  {
    path: ':uid',
    component: UserCalendarPage,
    canActivate: [UserGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UserCalendarPageRoutingModule {}
