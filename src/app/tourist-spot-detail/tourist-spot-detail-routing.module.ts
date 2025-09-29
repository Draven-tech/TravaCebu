import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TouristSpotDetailPage } from './tourist-spot-detail.page';

const routes: Routes = [
  {
    path: '',
    component: TouristSpotDetailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TouristSpotDetailPageRoutingModule {}
