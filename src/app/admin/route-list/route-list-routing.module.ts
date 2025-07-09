import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { RouteListPage } from './route-list.page';

const routes: Routes = [
  {
    path: '',
    component: RouteListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RouteListPageRoutingModule {}
