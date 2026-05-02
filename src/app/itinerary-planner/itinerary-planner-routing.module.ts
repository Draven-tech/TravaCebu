import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ItineraryPlannerPage } from './itinerary-planner.page';

const routes: Routes = [
  {
    path: '',
    component: ItineraryPlannerPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ItineraryPlannerPageRoutingModule {}
