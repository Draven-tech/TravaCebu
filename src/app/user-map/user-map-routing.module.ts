import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { UserMapPage } from './user-map.page';

const routes: Routes = [
  {
    path: '',
    component: UserMapPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UserMapPageRoutingModule {}
