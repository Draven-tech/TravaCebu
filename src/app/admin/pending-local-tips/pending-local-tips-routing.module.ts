import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PendingLocalTipsPage } from './pending-local-tips.page';

const routes: Routes = [
  {
    path: '',
    component: PendingLocalTipsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PendingLocalTipsPageRoutingModule {}
