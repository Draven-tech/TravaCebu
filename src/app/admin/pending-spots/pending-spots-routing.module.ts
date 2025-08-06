import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PendingSpotsPage } from './pending-spots.page';

const routes: Routes = [
  {
    path: '',
    component: PendingSpotsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PendingSpotsPageRoutingModule {} 