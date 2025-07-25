import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TermsPage } from './terms.page';

const routes: Routes = [
  {
    path: '',
    component: TermsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TermsPageRoutingModule {} 