import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MySubmissionsPage } from './my-submissions.page';

const routes: Routes = [
  {
    path: '',
    component: MySubmissionsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MySubmissionsPageRoutingModule {} 