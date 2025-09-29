import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TouristSpotListPage } from './tourist-spot-list.page';

const routes: Routes = [
  {
    path: '',
    component: TouristSpotListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TouristSpotListPageRoutingModule {}
