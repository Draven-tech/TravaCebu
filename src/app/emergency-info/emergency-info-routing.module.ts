import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EmergencyInfoPage } from './emergency-info.page';

const routes: Routes = [
  {
    path: '',
    component: EmergencyInfoPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EmergencyInfoPageRoutingModule {}
