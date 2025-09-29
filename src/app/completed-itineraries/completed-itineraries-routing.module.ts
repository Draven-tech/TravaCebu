import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CompletedItinerariesPage } from './completed-itineraries.page';

const routes: Routes = [
  {
    path: '',
    component: CompletedItinerariesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CompletedItinerariesPageRoutingModule {}
