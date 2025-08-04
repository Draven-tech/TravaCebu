import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MyItinerariesPage } from './my-itineraries.page';

const routes: Routes = [
  {
    path: '',
    component: MyItinerariesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MyItinerariesPageRoutingModule {} 