import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BucketListPage } from './bucket-list.page';

const routes: Routes = [
  {
    path: '',
    component: BucketListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BucketListPageRoutingModule {}
